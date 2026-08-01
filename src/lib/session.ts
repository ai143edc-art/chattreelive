// Remember which page the user is on + the chat they're editing, so a *refresh*
// (F5 / pull-to-refresh) keeps them on the same page with their work — WITHOUT
// turning every fresh visit into "reopen the last page". That's why this uses
// sessionStorage, not sessionStorage: it survives a reload of the same tab, but is
// cleared when the tab is closed / a new tab is opened, so a normal fresh visit
// starts on the landing page like any good website.
// Uploaded .zip media are blob: URLs that die on reload, so they're dropped
// (the messages stay; the images just need re-adding).
import type { Message, DateOrder } from './parser';

export type LastScreen = 'landing' | 'upload' | 'viewer' | 'myrooms';

export interface EditorDraft {
  messages: Message[];
  senders: string[];
  meName: string | null;
  contactTitle: string;
  status: string;
  showStatusBar: boolean;
  showTyping: boolean;
  dateOrder: DateOrder;
  modelName: string;
  theme: 'light' | 'dark';
  showFrame: boolean;
  wallpaper: string;
  avatar: string | null;
  mediaMap: Record<string, string>;
}

const SCREEN_KEY = 'chattree_last_screen';
const DRAFT_KEY = 'chattree_editor_draft';

export function saveScreen(s: LastScreen): void {
  try { sessionStorage.setItem(SCREEN_KEY, s); } catch { /* ignore */ }
}
export function loadScreen(): LastScreen | null {
  try {
    const s = sessionStorage.getItem(SCREEN_KEY);
    return s === 'landing' || s === 'upload' || s === 'viewer' || s === 'myrooms' ? s : null;
  } catch { return null; }
}

export function saveDraft(d: EditorDraft): void {
  // blob: URLs point at in-memory Blobs that don't survive a reload — never persist them.
  const media: Record<string, string> = {};
  for (const [k, v] of Object.entries(d.mediaMap || {})) if (v && !v.startsWith('blob:')) media[k] = v;
  // Try progressively lighter payloads if sessionStorage is full (big chats / custom wallpaper).
  const variants: EditorDraft[] = [
    { ...d, mediaMap: media },
    { ...d, mediaMap: {} },
    { ...d, mediaMap: {}, wallpaper: d.wallpaper.includes('data:') ? '' : d.wallpaper },
  ];
  for (const v of variants) {
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(v)); return; } catch { /* quota — try a lighter one */ }
  }
}
export function loadDraft(): EditorDraft | null {
  try {
    const s = sessionStorage.getItem(DRAFT_KEY);
    if (!s) return null;
    const d = JSON.parse(s);
    return d && Array.isArray(d.messages) ? (d as EditorDraft) : null;
  } catch { return null; }
}
export function clearDraft(): void {
  try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}
