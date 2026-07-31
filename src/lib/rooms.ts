// "Continue Chat" — live 2-person rooms on top of an imported chat.
// A room stores the imported history + the PIN (hashed server-side). New
// messages are posted through a PIN-checked RPC and delivered live via
// Supabase Realtime. The room id is an unguessable UUID (the shareable secret);
// the PIN is the second gate. NOTE: this is an experiment — messages are NOT
// end-to-end encrypted; they live on our server.
import { sb } from './supabase';
import type { Message } from './parser';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type Side = 'creator' | 'guest';

export interface RoomInfo {
  creatorName: string;
  guestName: string;
  history: Message[];
  isCreator: boolean;   // is the person joining the room's owner (vs the guest)?
}
export interface RoomMedia { url: string; type: string; name: string; size?: number }   // type: image | video | audio | file
export interface Reaction { by: string; emoji: string }
export interface ReplyTo { name: string; text: string }
export interface RoomMessage {
  id?: number;
  sender: Side;
  senderName: string;
  body: string;
  createdAt?: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  mediaName?: string | null;
  reactions?: Reaction[];
  replyName?: string | null;
  replyText?: string | null;
  deleted?: boolean;
}
export interface MyRoom {
  id: string;
  creatorName: string;
  guestName: string;
  lastActiveAt: string;
}

/** Create a room from an imported chat. Creator must be logged in. Returns the room id. */
export async function createRoom(pin: string, creatorName: string, guestName: string, history: Message[]): Promise<string> {
  const { data, error } = await sb.rpc('create_room', {
    p_pin: pin, p_creator_name: creatorName, p_guest_name: guestName, p_history: history,
  });
  if (error) throw error;
  return data as string;
}

/** Join a room with its PIN. Returns room info + history, or null if the PIN is wrong / room gone. */
export async function joinRoom(id: string, pin: string): Promise<RoomInfo | null> {
  const { data, error } = await sb.rpc('join_room', { p_id: id, p_pin: pin });
  if (error) throw error;
  const arr = (data || []) as { creator_name: string; guest_name: string; history: Message[]; is_creator: boolean }[];
  if (!arr.length) return null;
  const r = arr[0];
  return { creatorName: r.creator_name, guestName: r.guest_name, history: r.history || [], isCreator: !!r.is_creator };
}

/** Load the saved continued messages of a room (everything sent after the import). */
export async function fetchRoomMessages(id: string): Promise<RoomMessage[]> {
  const { data, error } = await sb.from('room_messages')
    .select('id, sender, sender_name, body, created_at, media_url, media_type, media_name, reactions, reply_name, reply_text, deleted')
    .eq('room_id', id).order('id', { ascending: true });
  if (error) throw error;
  return (data || []).map((r) => ({
    id: r.id as number, sender: r.sender as Side, senderName: r.sender_name as string,
    body: r.body as string, createdAt: r.created_at as string,
    mediaUrl: r.media_url as string | null, mediaType: r.media_type as string | null, mediaName: r.media_name as string | null,
    reactions: (r.reactions as Reaction[] | null) || [],
    replyName: r.reply_name as string | null, replyText: r.reply_text as string | null, deleted: !!r.deleted,
  }));
}

/** Add / change / remove your emoji reaction on a message (PIN-checked; realtime delivers it). */
export async function reactMessage(id: string, pin: string, messageId: number, by: string, emoji: string): Promise<void> {
  const { error } = await sb.rpc('react_message', {
    p_id: id, p_pin: pin, p_message_id: messageId, p_by: by, p_emoji: emoji,
  });
  if (error) throw error;
}

/** Delete your own message for everyone (leaves a "deleted" tombstone). PIN-checked. */
export async function deleteMessage(id: string, pin: string, messageId: number, by: string): Promise<void> {
  const { error } = await sb.rpc('delete_room_message', {
    p_id: id, p_pin: pin, p_message_id: messageId, p_by: by,
  });
  if (error) throw error;
}

export interface RoomSync { otherSeenAt: string | null; otherReadUpto: number }
/** Heartbeat: stamp my "seen now" + how far I've read, and get back the other
 *  side's last-seen time + read mark (powers online/last-seen + blue ticks). */
export async function roomSync(id: string, pin: string, side: Side, readUpto: number): Promise<RoomSync> {
  const { data, error } = await sb.rpc('room_sync', {
    p_id: id, p_pin: pin, p_side: side, p_read_upto: readUpto,
  });
  if (error) throw error;
  const row = ((data || []) as { other_seen_at: string | null; other_read_upto: number }[])[0];
  return { otherSeenAt: row?.other_seen_at ?? null, otherReadUpto: Number(row?.other_read_upto ?? 0) };
}

/** Post a message (the PIN is verified server-side; realtime then delivers it to both sides). */
export async function postMessage(id: string, pin: string, sender: Side, senderName: string, body: string, media?: RoomMedia, reply?: ReplyTo | null): Promise<void> {
  const { error } = await sb.rpc('post_room_message', {
    p_id: id, p_pin: pin, p_sender: sender, p_sender_name: senderName, p_body: body,
    p_media_url: media?.url ?? null, p_media_type: media?.type ?? null, p_media_name: media?.name ?? null,
    p_reply_name: reply?.name ?? null, p_reply_text: reply?.text ?? null,
  });
  if (error) throw error;
}

/** Upload a file to the room's (public) media bucket and return its URL + kind. */
export async function uploadRoomMedia(roomId: string, file: File): Promise<RoomMedia> {
  const ext = (file.name.match(/\.([a-z0-9]+)$/i)?.[1] || 'bin').toLowerCase();
  const rand = (crypto as Crypto).randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const path = `${roomId}/${rand}.${ext}`;
  const { error } = await sb.storage.from('room-media').upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw error;
  const url = sb.storage.from('room-media').getPublicUrl(path).data.publicUrl;
  const type = file.type.startsWith('image/') ? 'image'
    : file.type.startsWith('video/') ? 'video'
      : file.type.startsWith('audio/') ? 'audio' : 'file';
  return { url, type, name: file.name, size: file.size };
}

type RowShape = { id: number; sender: Side; sender_name: string; body: string; created_at: string; media_url: string | null; media_type: string | null; media_name: string | null; reactions: Reaction[] | null; reply_name: string | null; reply_text: string | null; deleted: boolean | null };
const rowToMsg = (r: RowShape): RoomMessage => ({
  id: r.id, sender: r.sender, senderName: r.sender_name, body: r.body, createdAt: r.created_at,
  mediaUrl: r.media_url, mediaType: r.media_type, mediaName: r.media_name, reactions: r.reactions || [],
  replyName: r.reply_name, replyText: r.reply_text, deleted: !!r.deleted,
});

/** Live-subscribe to a room. Fires on new messages AND on reaction changes (INSERT + UPDATE).
 *  The callback should upsert by id (replace if present, else append). Returns an unsubscribe fn. */
export function subscribeRoom(id: string, onMessage: (m: RoomMessage) => void): () => void {
  const ch: RealtimeChannel = sb
    .channel(`room-${id}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'room_messages', filter: `room_id=eq.${id}` },
      (payload) => {
        if (payload.eventType === 'DELETE') return;
        onMessage(rowToMsg(payload.new as RowShape));
      })
    .subscribe();
  return () => { sb.removeChannel(ch); };
}

/** Live "typing…" over Realtime broadcast (no DB). Returns a throttled notifier + unsubscribe.
 *  onTyping fires with the other person's name each time they type. */
export function subscribeTyping(id: string, myName: string, onTyping: (name: string) => void): { notify: () => void; unsub: () => void } {
  const ch: RealtimeChannel = sb.channel(`typing-${id}`, { config: { broadcast: { self: false } } });
  ch.on('broadcast', { event: 'typing' }, (p) => {
    const n = (p.payload as { name?: string })?.name;
    if (n) onTyping(n);
  }).subscribe();
  let last = 0;
  const notify = () => {
    const now = Date.now();
    if (now - last < 1500) return;   // don't spam the channel on every keystroke
    last = now;
    ch.send({ type: 'broadcast', event: 'typing', payload: { name: myName } });
  };
  return { notify, unsub: () => { sb.removeChannel(ch); } };
}

/** Rooms the signed-in user created (recoverable from any device once logged in). */
export async function listMyRooms(): Promise<MyRoom[]> {
  const { data, error } = await sb.from('rooms')
    .select('id, creator_name, guest_name, last_active_at')
    .order('last_active_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((r) => ({
    id: r.id as string, creatorName: r.creator_name as string,
    guestName: r.guest_name as string, lastActiveAt: r.last_active_at as string,
  }));
}

// --- device-local room memory (so you can return even without logging in, and
// so guests — who have no account — can reopen from the same phone/browser). ---
export interface StoredRoom { id: string; pin: string; myName: string; otherName: string; isCreator: boolean; at: number }
const LS_KEY = 'chattree_live_rooms';

export function recentRooms(): StoredRoom[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') as StoredRoom[]; } catch { return []; }
}
/** Save (or refresh) a room on this device so it shows in "recent" and can be reopened. */
export function rememberRoom(r: Omit<StoredRoom, 'at'>): void {
  try {
    const list = recentRooms().filter((x) => x.id !== r.id);
    list.unshift({ ...r, at: Date.now() });
    localStorage.setItem(LS_KEY, JSON.stringify(list.slice(0, 25)));
  } catch { /* localStorage unavailable — non-fatal */ }
}
export function forgetRoom(id: string): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(recentRooms().filter((x) => x.id !== id))); } catch { /* ignore */ }
}

// per-room label + custom title, device-local (works for guests too, no DB needed)
export interface RoomMeta { title?: string; tag?: string }
const META_KEY = 'chattree_live_meta';
export function allRoomMeta(): Record<string, RoomMeta> {
  try { return JSON.parse(localStorage.getItem(META_KEY) || '{}') as Record<string, RoomMeta>; } catch { return {}; }
}
export function setRoomMeta(id: string, patch: RoomMeta): void {
  try {
    const all = allRoomMeta();
    all[id] = { ...all[id], ...patch };
    localStorage.setItem(META_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

/** Permanently delete a room + all its messages (both sides). Only the logged-in
 *  creator can — returns true if it was actually deleted on the server. */
export async function deleteRoom(id: string): Promise<boolean> {
  const { data, error } = await sb.rpc('delete_room', { p_id: id });
  if (error) throw error;
  return !!data;
}
