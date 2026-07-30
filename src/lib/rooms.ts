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
export interface RoomMedia { url: string; type: string; name: string }   // type: image | video | audio | file
export interface RoomMessage {
  id?: number;
  sender: Side;
  senderName: string;
  body: string;
  createdAt?: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  mediaName?: string | null;
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
    .select('id, sender, sender_name, body, created_at, media_url, media_type, media_name')
    .eq('room_id', id).order('id', { ascending: true });
  if (error) throw error;
  return (data || []).map((r) => ({
    id: r.id as number, sender: r.sender as Side, senderName: r.sender_name as string,
    body: r.body as string, createdAt: r.created_at as string,
    mediaUrl: r.media_url as string | null, mediaType: r.media_type as string | null, mediaName: r.media_name as string | null,
  }));
}

/** Post a message (the PIN is verified server-side; realtime then delivers it to both sides). */
export async function postMessage(id: string, pin: string, sender: Side, senderName: string, body: string, media?: RoomMedia): Promise<void> {
  const { error } = await sb.rpc('post_room_message', {
    p_id: id, p_pin: pin, p_sender: sender, p_sender_name: senderName, p_body: body,
    p_media_url: media?.url ?? null, p_media_type: media?.type ?? null, p_media_name: media?.name ?? null,
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
  return { url, type, name: file.name };
}

/** Live-subscribe to new messages in a room. Returns an unsubscribe function. */
export function subscribeRoom(id: string, onMessage: (m: RoomMessage) => void): () => void {
  const ch: RealtimeChannel = sb
    .channel(`room-${id}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'room_messages', filter: `room_id=eq.${id}` },
      (payload) => {
        const r = payload.new as { id: number; sender: Side; sender_name: string; body: string; created_at: string; media_url: string | null; media_type: string | null; media_name: string | null };
        onMessage({ id: r.id, sender: r.sender, senderName: r.sender_name, body: r.body, createdAt: r.created_at, mediaUrl: r.media_url, mediaType: r.media_type, mediaName: r.media_name });
      })
    .subscribe();
  return () => { sb.removeChannel(ch); };
}

/** Rooms the signed-in user created (for a "my rooms" list). */
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
