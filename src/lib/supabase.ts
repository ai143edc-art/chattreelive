import { createClient } from '@supabase/supabase-js';
import type { Session } from '@supabase/supabase-js';

// The anon key is public by design — all access is enforced by Row Level
// Security, so it is safe to ship in the client. Env vars take precedence when
// set (to point at another project or rotate the key); otherwise we fall back
// to the known public project so the site never white-screens if the hosting
// environment hasn't been configured with the vars.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
  || 'https://clwvevblnkghewrkkplw.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsd3ZldmJsbmtnaGV3cmtrcGx3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MDQ5ODEsImV4cCI6MjEwMDk4MDk4MX0.qtOVXXo2eFixehKRF-xNwM809A2NyD4WxrlzfHTPbj4';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export interface ChatRow {
  id: string;
  user_id?: string;
  title?: string;
  contact_title?: string;
  me_name?: string | null;
  model?: string;
  theme?: string;
  chat_text?: string;
  media_map?: Record<string, string>;
  msg_count?: number;
  media_count?: number;
  avatar?: string | null;
  share_token?: string | null;
  shared_media?: Record<string, string>;
  share_expires_at?: string | null;   // null = never expires
  category?: string | null;
  created_at?: string;
}
export interface SaveMeta {
  contactTitle: string; meName: string | null; model: string; theme: string; rawText: string;
  msgCount: number; mediaCount: number; avatar: string | null; category?: string | null;
}

export function uuidv4(): string {
  const c = window.crypto as Crypto | undefined;
  if (c && 'randomUUID' in c) { try { return c.randomUUID(); } catch { /* fall through */ } }
  const b = new Uint8Array(16);
  if (c && c.getRandomValues) c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0'));
  return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}`;
}

/* ---------------- Auth ---------------- */
export function signUp(email: string, password: string, captchaToken?: string) {
  // Send the confirmation link back to THIS site (not Supabase's default Site URL,
  // which starts life as http://localhost:3000). The URL must also be whitelisted
  // in Supabase → Auth → URL Configuration → Redirect URLs for this to take effect.
  return sb.auth.signUp({
    email, password,
    options: { emailRedirectTo: window.location.origin, ...(captchaToken ? { captchaToken } : {}) },
  });
}
export function signIn(email: string, password: string, captchaToken?: string) {
  return sb.auth.signInWithPassword({ email, password, options: captchaToken ? { captchaToken } : undefined });
}
export function signInWithGoogle() {
  return sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: location.origin },
  });
}
export function signOut() { return sb.auth.signOut(); }
/** Send a password-reset email. The link returns the user to the app with a
 *  recovery session, which onPasswordRecovery() below picks up. */
export async function resetPassword(email: string, captchaToken?: string): Promise<void> {
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: location.origin,
    ...(captchaToken ? { captchaToken } : {}),
  });
  if (error) throw error;
}
export async function changePassword(newPassword: string): Promise<void> {
  const { error } = await sb.auth.updateUser({ password: newPassword });
  if (error) throw error;
}
/** Fires when the user arrives via a password-reset link, so the UI can prompt
 *  for a new password. Returns an unsubscribe function. */
export function onPasswordRecovery(cb: () => void): () => void {
  const { data: { subscription } } = sb.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') cb();
  });
  return () => subscription.unsubscribe();
}
export async function deleteAccount(): Promise<void> {
  const { data: { user } } = await sb.auth.getUser();
  if (user) {
    const { data: folders } = await sb.storage.from('user-media').list(user.id);
    for (const folder of folders || []) {
      const { data: files } = await sb.storage.from('user-media').list(`${user.id}/${folder.name}`);
      if (files && files.length) {
        await sb.storage.from('user-media').remove(files.map((f) => `${user.id}/${folder.name}/${f.name}`));
      }
    }
  }
  const { error } = await sb.rpc('delete_own_account');
  if (error) throw error;
  await sb.auth.signOut();
}
export function onAuthChange(cb: (session: Session | null) => void): () => void {
  sb.auth.getSession().then(({ data }) => cb(data.session));
  const { data: { subscription } } = sb.auth.onAuthStateChange((_e, session) => cb(session));
  return () => subscription.unsubscribe();
}

/* ---------------- Per-user chats ---------------- */
export interface SaveResult { failed: number; total: number }

/**
 * The content type to declare on upload, from the file's extension.
 *
 * This matters more than it looks: media pulled out of a WhatsApp .zip comes
 * back from JSZip as a Blob with an empty `type`, and when no content type is
 * given, supabase-js defaults it to `text/plain`. The user-media bucket only
 * accepts image/video/audio/pdf, so a text/plain upload is rejected — which is
 * exactly why saved chats were coming back with every photo missing. Naming the
 * real type keeps the bucket happy without touching the file's bytes.
 */
const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', bmp: 'image/bmp', heic: 'image/heic',
  mp4: 'video/mp4', '3gp': 'video/3gpp', mov: 'video/quicktime',
  mkv: 'video/x-matroska', webm: 'video/webm', avi: 'video/x-msvideo',
  opus: 'audio/ogg', mp3: 'audio/mpeg', aac: 'audio/aac', m4a: 'audio/mp4',
  wav: 'audio/wav', ogg: 'audio/ogg', amr: 'audio/amr',
  pdf: 'application/pdf',
};
function contentTypeFor(name: string, blobType: string): string {
  // A concrete image/video/audio/pdf type from the blob is trusted as-is; a
  // missing or generic one is replaced from the extension so it isn't dropped.
  if (blobType && blobType !== 'application/octet-stream' && blobType !== 'text/plain') return blobType;
  const ext = (name.match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase() || '';
  return MIME_BY_EXT[ext] || blobType || 'application/octet-stream';
}

/**
 * Uploading the media used to be a `for` loop that awaited each file, so a chat
 * with a few hundred photos took minutes and any file that hit a transient
 * error was silently skipped — which is why some reopened chats came back with
 * missing images. Now the uploads run several at a time with a retry, and the
 * blobs are sent untouched, so nothing is recompressed and quality is preserved.
 */
export async function saveChat(
  meta: SaveMeta,
  mediaBlobs: Record<string, Blob>,
  onProgress?: (done: number, total: number) => void,
): Promise<SaveResult> {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error('Please log in first.');
  const id = uuidv4();
  const files = Object.keys(mediaBlobs);
  const cloudMap: Record<string, string> = {};
  const failed: string[] = [];
  let done = 0;

  const uploadOne = async (fname: string): Promise<void> => {
    const blob = mediaBlobs[fname];
    const safe = fname.replace(/[^a-z0-9._-]+/gi, '_');
    const path = `${user.id}/${id}/${safe}`;
    // One retry: most failures at this scale are transient (a dropped request
    // in a burst), and a second attempt usually lands.
    const contentType = contentTypeFor(fname, blob.type);
    for (let attempt = 0; attempt < 2; attempt++) {
      const up = await sb.storage.from('user-media').upload(path, blob, { upsert: true, contentType });
      if (!up.error) { cloudMap[fname] = path; break; }   // store the PATH; sign on load
      if (attempt === 1) { failed.push(fname); console.warn('media upload failed:', fname, up.error); }
    }
    onProgress?.(++done, files.length);
  };

  // A small pool of workers pulling from the queue — fast, but bounded so we
  // never open hundreds of sockets at once.
  const CONCURRENCY = 6;
  let next = 0;
  const worker = async () => { while (next < files.length) await uploadOne(files[next++]); };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker));

  const row: ChatRow = {
    id, user_id: user.id, title: meta.contactTitle, contact_title: meta.contactTitle,
    me_name: meta.meName, model: meta.model, theme: meta.theme, chat_text: meta.rawText, media_map: cloudMap,
    msg_count: meta.msgCount, media_count: meta.mediaCount, avatar: meta.avatar,
    category: meta.category ?? null,
  };
  const { error } = await sb.from('user_chats').insert(row);
  if (error) throw error;
  return { failed: failed.length, total: files.length };
}

export async function listChats(): Promise<ChatRow[]> {
  const { data, error } = await sb.from('user_chats')
    .select('id,title,contact_title,created_at,msg_count,media_count,category,avatar')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as ChatRow[];
}
export async function getChat(id: string): Promise<ChatRow | null> {
  const { data, error } = await sb.from('user_chats').select('*').eq('id', id).single();
  if (error) throw error;
  const row = data as ChatRow;
  row.media_map = await signMediaMap(row.media_map || {});
  return row;
}

/** Turn stored storage-paths into short-lived signed URLs (private bucket). */
async function signMediaMap(map: Record<string, string>): Promise<Record<string, string>> {
  const entries = Object.entries(map);
  if (!entries.length) return {};
  const out: Record<string, string> = {};
  const toSign: { fname: string; path: string }[] = [];
  for (const [fname, val] of entries) {
    if (/^https?:\/\//i.test(val)) out[fname] = val;      // legacy public URL — keep as-is
    else toSign.push({ fname, path: val });
  }
  if (toSign.length) {
    const { data, error } = await sb.storage.from('user-media')
      .createSignedUrls(toSign.map((t) => t.path), 3600);  // valid 1 hour
    if (error) throw error;
    (data || []).forEach((d, i) => {
      if (d.signedUrl && !d.error) out[toSign[i].fname] = d.signedUrl;
    });
  }
  return out;
}
export async function renameChat(id: string, title: string): Promise<void> {
  const { error } = await sb.from('user_chats').update({ title, contact_title: title }).eq('id', id);
  if (error) throw error;
}
export async function updateCategory(id: string, category: string | null): Promise<void> {
  const { error } = await sb.from('user_chats').update({ category }).eq('id', id);
  if (error) throw error;
}
export interface ShareResult { url: string; expiresAt: string | null }

/**
 * Make a chat shareable. `ttlSeconds` sets how long the link stays valid
 * (0 = never expires). Media signed URLs are minted for the same window, so
 * photos die with the link. Re-calling with a different TTL keeps the same
 * token — the link doesn't change, only its expiry does.
 */
export async function shareChat(id: string, ttlSeconds = 0): Promise<ShareResult> {
  const { data, error } = await sb.from('user_chats').select('media_map, share_token').eq('id', id).single();
  if (error) throw error;
  const row = data as ChatRow;
  const map = row.media_map || {};
  const sharedMedia: Record<string, string> = {};
  const toSign: { fname: string; path: string }[] = [];
  for (const [fname, val] of Object.entries(map)) {
    if (/^https?:\/\//i.test(val)) sharedMedia[fname] = val;
    else toSign.push({ fname, path: val });
  }
  const YEAR = 60 * 60 * 24 * 365;
  const mediaTtl = ttlSeconds > 0 ? Math.max(ttlSeconds, 60) : YEAR;
  if (toSign.length) {
    const { data: signed, error: e2 } = await sb.storage.from('user-media')
      .createSignedUrls(toSign.map((t) => t.path), mediaTtl);
    if (e2) throw e2;
    (signed || []).forEach((s, i) => { if (s.signedUrl && !s.error) sharedMedia[toSign[i].fname] = s.signedUrl; });
  }
  const token = row.share_token || uuidv4();
  const expiresAt = ttlSeconds > 0 ? new Date(Date.now() + ttlSeconds * 1000).toISOString() : null;
  const { error: e3 } = await sb.from('user_chats')
    .update({ share_token: token, shared_media: sharedMedia, share_expires_at: expiresAt }).eq('id', id);
  if (e3) throw e3;
  return { url: `${location.origin}/?c=${token}`, expiresAt };
}
export async function unshareChat(id: string): Promise<void> {
  const { error } = await sb.from('user_chats')
    .update({ share_token: null, shared_media: null, share_expires_at: null }).eq('id', id);
  if (error) throw error;
}
export async function getSharedChat(token: string): Promise<ChatRow | null> {
  const { data, error } = await sb.rpc('get_shared_chat', { token });
  if (error) throw error;
  const arr = (data || []) as ChatRow[];
  if (!arr.length) return null;
  const r = arr[0];
  return { ...r, media_map: r.shared_media || {} };
}

export async function deleteChat(id: string): Promise<void> {
  const { data: { user } } = await sb.auth.getUser();
  if (user) {
    const folder = `${user.id}/${id}`;
    const { data: files } = await sb.storage.from('user-media').list(folder);
    if (files && files.length) {
      await sb.storage.from('user-media').remove(files.map((f) => `${folder}/${f.name}`));
    }
  }
  const { error } = await sb.from('user_chats').delete().eq('id', id);
  if (error) throw error;
}
