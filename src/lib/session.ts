// Remember which page the user is on + the chat they're editing, so a page
// refresh (or reopening the tab) drops them back exactly where they were —
// not on the landing page. Text + all settings persist in localStorage.
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
  try { localStorage.setItem(SCREEN_KEY, s); } catch { /* ignore */ }
}
export function loadScreen(): LastScreen | null {
  try {
    const s = localStorage.getItem(SCREEN_KEY);
    return s === 'landing' || s === 'upload' || s === 'viewer' || s === 'myrooms' ? s : null;
  } catch { return null; }
}

export function saveDraft(d: EditorDraft): void {
  // blob: URLs point at in-memory Blobs that don't survive a reload — never persist them.
  const media: Record<string, string> = {};
  for (const [k, v] of Object.entries(d.mediaMap || {})) if (v && !v.startsWith('blob:')) media[k] = v;
  // Try progressively lighter payloads if localStorage is full (big chats / custom wallpaper).
  const variants: EditorDraft[] = [
    { ...d, mediaMap: media },
    { ...d, mediaMap: {} },
    { ...d, mediaMap: {}, wallpaper: d.wallpaper.includes('data:') ? '' : d.wallpaper },
  ];
  for (const v of variants) {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(v)); return; } catch { /* quota — try a lighter one */ }
  }
}
export function loadDraft(): EditorDraft | null {
  try {
    const s = localStorage.getItem(DRAFT_KEY);
    if (!s) return null;
    const d = JSON.parse(s);
    return d && Array.isArray(d.messages) ? (d as EditorDraft) : null;
  } catch { return null; }
}
export function clearDraft(): void {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}
