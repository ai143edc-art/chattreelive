import { sb } from './supabase';
import { findAttachment, type Message } from './parser';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type HistoryMessage = Message & { mediaUrl?: string | null; mediaType?: string | null; mediaName?: string | null };

export type Side = 'creator' | 'guest';

export interface RoomInfo {
  creatorName: string;
  guestName: string;
  history: HistoryMessage[];
  isCreator: boolean;
}
export interface RoomMedia { url: string; type: string; name: string; size?: number }
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

export async function createRoom(pin: string, creatorName: string, guestName: string, history: Message[]): Promise<string> {
  const { data, error } = await sb.rpc('create_room', {
    p_pin: pin, p_creator_name: creatorName, p_guest_name: guestName, p_history: history,
  });
  if (error) throw error;
  return data as string;
}

export async function joinRoom(id: string, pin: string): Promise<RoomInfo | null> {
  const { data, error } = await sb.rpc('join_room', { p_id: id, p_pin: pin });
  if (error) throw error;
  const arr = (data || []) as { creator_name: string; guest_name: string; history: Message[]; is_creator: boolean }[];
  if (!arr.length) return null;
  const r = arr[0];
  return { creatorName: r.creator_name, guestName: r.guest_name, history: r.history || [], isCreator: !!r.is_creator };
}

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

export async function reactMessage(id: string, pin: string, messageId: number, by: string, emoji: string): Promise<void> {
  const { error } = await sb.rpc('react_message', {
    p_id: id, p_pin: pin, p_message_id: messageId, p_by: by, p_emoji: emoji,
  });
  if (error) throw error;
}

export async function deleteMessage(id: string, pin: string, messageId: number, by: string): Promise<void> {
  const { error } = await sb.rpc('delete_room_message', {
    p_id: id, p_pin: pin, p_message_id: messageId, p_by: by,
  });
  if (error) throw error;
}

export interface RoomSync { otherSeenAt: string | null; otherReadUpto: number }

export async function roomSync(id: string, pin: string, side: Side, readUpto: number): Promise<RoomSync> {
  const { data, error } = await sb.rpc('room_sync', {
    p_id: id, p_pin: pin, p_side: side, p_read_upto: readUpto,
  });
  if (error) throw error;
  const row = ((data || []) as { other_seen_at: string | null; other_read_upto: number }[])[0];
  return { otherSeenAt: row?.other_seen_at ?? null, otherReadUpto: Number(row?.other_read_upto ?? 0) };
}

export async function postMessage(id: string, pin: string, sender: Side, senderName: string, body: string, media?: RoomMedia, reply?: ReplyTo | null): Promise<void> {
  const { error } = await sb.rpc('post_room_message', {
    p_id: id, p_pin: pin, p_sender: sender, p_sender_name: senderName, p_body: body,
    p_media_url: media?.url ?? null, p_media_type: media?.type ?? null, p_media_name: media?.name ?? null,
    p_reply_name: reply?.name ?? null, p_reply_text: reply?.text ?? null,
  });
  if (error) throw error;
}

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

const MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', heic: 'image/heic',
  mp4: 'video/mp4', '3gp': 'video/3gpp', mov: 'video/quicktime', mkv: 'video/x-matroska', webm: 'video/webm', avi: 'video/x-msvideo',
  opus: 'audio/ogg', amr: 'audio/amr', mp3: 'audio/mpeg', aac: 'audio/aac', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg',
  pdf: 'application/pdf', vcf: 'text/vcard',
};
export function guessMime(name: string): string {
  return MIME[(name.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase()] || 'application/octet-stream';
}

export async function uploadImportedMedia(
  roomId: string,
  messages: Message[],
  blobs: Record<string, Blob>,
  onProgress?: (done: number, total: number) => void,
): Promise<{ history: HistoryMessage[]; changed: boolean }> {
  const history = messages.map((m) => ({ ...m })) as HistoryMessage[];

  const jobs: { i: number; name: string; blob: Blob }[] = [];
  for (let i = 0; i < history.length; i++) {
    const att = findAttachment(history[i].text);
    if (!att) continue;
    const base = att.split('/').pop()!.toLowerCase();
    const blob = blobs[base];
    if (blob) jobs.push({ i, name: att.split('/').pop()!, blob });
  }
  if (!jobs.length) return { history, changed: false };

  let done = 0;
  onProgress?.(0, jobs.length);
  for (const j of jobs) {
    try {
      const file = new File([j.blob], j.name, { type: j.blob.type || guessMime(j.name) });
      const media = await uploadRoomMedia(roomId, file);
      history[j.i].mediaUrl = media.url;
      history[j.i].mediaType = media.type;
      history[j.i].mediaName = media.name;
    } catch {  }
    done++;
    onProgress?.(done, jobs.length);
  }
  return { history, changed: true };
}

export async function setRoomHistory(id: string, pin: string, history: HistoryMessage[]): Promise<void> {
  const { error } = await sb.rpc('set_room_history', { p_id: id, p_pin: pin, p_history: history });
  if (error) throw error;
}

type RowShape = { id: number; sender: Side; sender_name: string; body: string; created_at: string; media_url: string | null; media_type: string | null; media_name: string | null; reactions: Reaction[] | null; reply_name: string | null; reply_text: string | null; deleted: boolean | null };
const rowToMsg = (r: RowShape): RoomMessage => ({
  id: r.id, sender: r.sender, senderName: r.sender_name, body: r.body, createdAt: r.created_at,
  mediaUrl: r.media_url, mediaType: r.media_type, mediaName: r.media_name, reactions: r.reactions || [],
  replyName: r.reply_name, replyText: r.reply_text, deleted: !!r.deleted,
});

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

export function subscribeTyping(id: string, myName: string, onTyping: (name: string) => void): { notify: () => void; unsub: () => void } {
  const ch: RealtimeChannel = sb.channel(`typing-${id}`, { config: { broadcast: { self: false } } });
  ch.on('broadcast', { event: 'typing' }, (p) => {
    const n = (p.payload as { name?: string })?.name;
    if (n) onTyping(n);
  }).subscribe();
  let last = 0;
  const notify = () => {
    const now = Date.now();
    if (now - last < 1500) return;
    last = now;
    ch.send({ type: 'broadcast', event: 'typing', payload: { name: myName } });
  };
  return { notify, unsub: () => { sb.removeChannel(ch); } };
}

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

export interface StoredRoom { id: string; pin: string; myName: string; otherName: string; isCreator: boolean; at: number }
const LS_KEY = 'chattree_live_rooms';

export function recentRooms(): StoredRoom[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') as StoredRoom[]; } catch { return []; }
}

export function rememberRoom(r: Omit<StoredRoom, 'at'>): void {
  try {
    const list = recentRooms().filter((x) => x.id !== r.id);
    list.unshift({ ...r, at: Date.now() });
    localStorage.setItem(LS_KEY, JSON.stringify(list.slice(0, 25)));
  } catch {  }
}
export function forgetRoom(id: string): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(recentRooms().filter((x) => x.id !== id))); } catch {  }
}

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
  } catch {  }
}

export async function deleteRoom(id: string): Promise<boolean> {

  try {
    const { data: files } = await sb.storage.from('room-media').list(id, { limit: 1000 });
    if (files && files.length) {
      await sb.storage.from('room-media').remove(files.map((f) => `${id}/${f.name}`));
    }
  } catch {  }

  const { data, error } = await sb.rpc('delete_room', { p_id: id });
  if (error) throw error;
  return !!data;
}
