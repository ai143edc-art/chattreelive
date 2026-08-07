export interface Message {
  date: string;
  time: string;
  sender: string | null;
  text: string;
  system: boolean;
  tick?: number;
  reply?: { sender: string; text: string };
  reactions?: string[];
  forwarded?: boolean;
  call?: { media: 'voice' | 'video'; title: string; sub: string; missed: boolean };
}

const IOS_RE = /^‎?\[(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?\s?(?:[APap][Mm])?)\]\s?([\s\S]*)$/;
const AND_RE = /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?\s?(?:[APap][Mm])?)\s[-–]\s([\s\S]*)$/;

export function stripMarks(s: string): string { return (s || '').replace(/[‎‏‪-‮]/g, ''); }

export function parseChat(text: string): Message[] {
  const lines = text.split(/\r?\n/);
  const out: Message[] = [];
  for (const raw of lines) {
    let m = IOS_RE.exec(raw);
    if (!m) m = AND_RE.exec(raw);
    if (m) {
      const date = m[1], time = m[2].trim();
      const rest = m[3];
      let sender: string | null = null, body = rest;
      const sm = /^([^:\n]{1,64}?):\s([\s\S]*)$/.exec(rest);
      if (sm) { sender = stripMarks(sm[1]).trim(); body = sm[2]; }
      out.push({ date, time, sender, text: body, system: !sender });
    } else if (out.length) {
      out[out.length - 1].text += "\n" + raw;
    }
  }
  return out;
}

export const MEDIA_EXT = /\.(jpe?g|png|gif|webp|bmp|heic|mp4|3gp|mov|mkv|webm|avi|opus|mp3|aac|m4a|wav|ogg|amr|pdf|docx?|xlsx?|pptx?|txt|vcf|zip|apk)$/i;
export const PLACEHOLDERS = /^\s*‎?(<Media omitted>|image omitted|video omitted|audio omitted|GIF omitted|sticker omitted|Contact card omitted|document omitted|This message was deleted\.?|You deleted this message\.?|null)\s*$/i;
const FNAME = /([^\s<>][^\n<>]*?\.(?:jpe?g|png|gif|webp|bmp|heic|mp4|3gp|mov|mkv|webm|avi|opus|mp3|aac|m4a|wav|ogg|amr|pdf|docx?|xlsx?|pptx?|txt|vcf|zip|apk))/i;

export function escRe(x: string): string { return x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

export function findAttachment(text: string): string | null {
  const clean = stripMarks(text);
  let m = /<attached:\s*([^>]+?)>/i.exec(clean);
  if (m) return m[1].trim();
  m = new RegExp(FNAME.source + "\\s*\\((?:file attached|attached)\\)", "i").exec(clean);
  if (m) return m[1].trim();
  m = new RegExp(FNAME.source + "\\s*[\\u2022•]", "i").exec(clean);
  if (m) return m[1].trim();
  const t = clean.trim();
  if (MEDIA_EXT.test(t) && t.split('\n').length === 1 && t.length < 80 && /\.[a-z0-9]{2,5}$/i.test(t)) return t;
  return null;
}

export function extractCaption(text: string, att: string): string {
  let s = stripMarks(text);
  const f = escRe(att);
  s = s.replace(/<attached:[^>]*>/ig, '')
       .replace(new RegExp(f + "\\s*\\((?:file attached|attached)\\)", "ig"), '')
       .replace(new RegExp(f + "\\s*[\\u2022•][^\\n]*", "ig"), '')
       .replace(new RegExp("^\\s*" + f + "\\s*", "i"), '');
  return s.trim();
}

export function mediaLabel(ext: string): string {
  ext = (ext || '').toLowerCase();
  if (/^(jpe?g|png|webp|bmp|heic)$/.test(ext)) return '📷 Photo';
  if (ext === 'gif') return '🎬 GIF';
  if (/^(mp4|3gp|mov|mkv|webm|avi)$/.test(ext)) return '🎥 Video';
  if (ext === 'opus' || ext === 'amr') return '🎤 Voice message';
  if (/^(mp3|aac|m4a|wav|ogg)$/.test(ext)) return '🎵 Audio';
  if (ext === 'vcf') return '👤 Contact';
  if (/^(pdf|docx?|xlsx?|pptx?|txt)$/.test(ext)) return '📄 Document';
  return '📎 File';
}
export function placeholderLabel(raw: string): string {
  const t = stripMarks(raw).toLowerCase();
  if (/image omitted/.test(t)) return '📷 Photo';
  if (/video omitted/.test(t)) return '🎥 Video';
  if (/audio omitted/.test(t)) return '🎤 Voice message';
  if (/sticker omitted/.test(t)) return '🖼️ Sticker';
  if (/gif omitted/.test(t)) return '🎬 GIF';
  if (/document omitted/.test(t)) return '📄 Document';
  if (/contact card omitted/.test(t)) return '👤 Contact';
  if (/deleted/.test(t)) return '🚫 This message was deleted';
  return '📎 Media';
}

export type DateOrder = 'DMY' | 'MDY';
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export function detectDateOrder(msgs: Message[]): DateOrder {
  for (const m of msgs) {
    const x = /^(\d{1,2})\/(\d{1,2})\//.exec(m.date || '');
    if (!x) continue;
    if (+x[1] > 12) return 'DMY';
    if (+x[2] > 12) return 'MDY';
  }
  return 'DMY';
}
export function formatDay(d: string, order: DateOrder): string {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec((d || '').trim());
  if (!m) return d;
  let y = +m[3]; if (y < 100) y += 2000;
  let day: number, mon: number;
  if (order === 'MDY') { mon = +m[1]; day = +m[2]; } else { day = +m[1]; mon = +m[2]; }
  if (mon < 1 || mon > 12 || day < 1 || day > 31) return d;
  return `${day} ${MONTHS[mon - 1]} ${y}`;
}

export function esc(s: string): string {
  return (s || '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>
  )[c]);
}

const D = '';
export function formatText(raw: string): string {
  let s = esc(stripMarks(raw));
  s = s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  const anchors: string[] = [];
  s = s.replace(/<a [^>]*>.*?<\/a>/g, (m) => { anchors.push(m); return D + (anchors.length - 1) + D; });
  s = s.replace(/```([^`]+?)```/g, '<code>$1</code>')
       .replace(/\*(\S(?:[^*\n]*\S)?)\*/g, '<b>$1</b>')
       .replace(/_(\S(?:[^_\n]*\S)?)_/g, '<i>$1</i>')
       .replace(/~(\S(?:[^~\n]*\S)?)~/g, '<s>$1</s>');
  s = s.replace(new RegExp(D + '(\\d+)' + D, 'g'), (_m, i) => anchors[+i]);
  return s;
}

export function emojiInfo(raw: string): number | null {
  const t = stripMarks(raw).replace(/\s+/g, '');
  if (!t) return null;
  const hasEmoji = /\p{Extended_Pictographic}/u.test(t);
  const leftover = t.replace(/[\p{Extended_Pictographic}‍️\u{1F3FB}-\u{1F3FF}\u{1F1E6}-\u{1F1FF}⃣#*0-9]/gu, '');
  if (!hasEmoji || leftover.length) return null;
  const count = (stripMarks(raw).match(/\p{Extended_Pictographic}/gu) || []).length;
  return count <= 3 ? count : null;
}

export function shortTime(t: string): string {
  return t.replace(/(\d{1,2}:\d{2}):\d{2}/, '$1');
}
export function colorFor(name: string): string {
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return 'c' + (h % 8);
}
const AVA_COLORS = ['#e5484d', '#1f7aec', '#0a8f68', '#a259c4', '#d9730d', '#c026a3', '#2a7d6f', '#8a6d00'];
export function avatarColor(name: string): string {
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVA_COLORS[h % 8];
}
export function initial(name: string): string {
  const t = stripMarks(name).trim();
  return t ? t[0].toUpperCase() : '?';
}
export function extOf(name: string): string {
  return (name.split('/').pop()!.toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '';
}
