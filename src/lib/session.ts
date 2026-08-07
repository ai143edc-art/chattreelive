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
  try { sessionStorage.setItem(SCREEN_KEY, s); } catch {  }
}
export function loadScreen(): LastScreen | null {
  try {
    const s = sessionStorage.getItem(SCREEN_KEY);
    return s === 'landing' || s === 'upload' || s === 'viewer' || s === 'myrooms' ? s : null;
  } catch { return null; }
}

export function saveDraft(d: EditorDraft): void {

  const media: Record<string, string> = {};
  for (const [k, v] of Object.entries(d.mediaMap || {})) if (v && !v.startsWith('blob:')) media[k] = v;

  const variants: EditorDraft[] = [
    { ...d, mediaMap: media },
    { ...d, mediaMap: {} },
    { ...d, mediaMap: {}, wallpaper: d.wallpaper.includes('data:') ? '' : d.wallpaper },
  ];
  for (const v of variants) {
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(v)); return; } catch {  }
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
  try { sessionStorage.removeItem(DRAFT_KEY); } catch {  }
}
