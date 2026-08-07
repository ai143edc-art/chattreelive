import * as P from './parser';
import type { Message, DateOrder } from './parser';
import { themeOf, sizeOf, defaultBookConfig, weaveCss, vignetteCss, rgba, SERIF_STACK, SANS_STACK } from './bookThemes';
import type { BookConfig, BookTheme } from './bookThemes';

const DOODLE_ART = "<svg xmlns='http://www.w3.org/2000/svg' width='260' height='260' viewBox='0 0 260 260'><g fill='none' stroke='%23__INK__' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='M34 46 q-9 -11 -17 -2 q-6 7 0 13 q5 6 17 15 q12 -9 17 -15 q6 -6 0 -13 q-8 -9 -17 2 z'/><path d='M100 30 h34 q6 0 6 6 v12 q0 6 -6 6 h-20 l-8 8 v-8 h-6 q-6 0 -6 -6 v-12 q0 -6 6 -6 z'/><circle cx='190' cy='36' r='2.2'/><circle cx='199' cy='36' r='2.2'/><circle cx='208' cy='36' r='2.2'/><path d='M16 108 q8 -11 16 0 q8 11 16 0'/><path d='M116 100 l4 9 l10 1 l-7 7 l2 10 l-9 -5 l-9 5 l2 -10 l-7 -7 l10 -1 z'/><rect x='182' y='100' width='30' height='22' rx='4'/><circle cx='197' cy='111' r='6'/><path d='M190 100 l3 -5 h8 l3 5'/><path d='M35 190 v-22 l16 -3 v22'/><circle cx='31' cy='190' r='4.5'/><circle cx='47' cy='187' r='4.5'/><path d='M104 178 h20 v10 q0 9 -10 9 q-10 0 -10 -9 z'/><path d='M124 180 q7 0 7 6 q0 6 -7 6'/><path d='M208 176 v14 M201 183 h14'/><circle cx='58' cy='232' r='7'/><path d='M120 240 q8 -9 16 0 q8 9 16 0'/><path d='M232 226 q-6 -7 -11 -1 q-4 4 0 8 q3 4 11 9 q8 -5 11 -9 q4 -4 0 -8 q-5 -6 -11 1 z'/><path d='M236 122 l8 8 l-8 8 l-8 -8 z'/><circle cx='72' cy='150' r='5'/><path d='M72 140 v-5 M72 160 v5 M62 150 h-5 M82 150 h5'/><path d='M150 62 q10 -6 20 0'/><circle cx='240' cy='196' r='3'/><path d='M18 62 q6 -8 12 0'/><path d='M160 150 h16 M168 142 v16'/></g></svg>";
const doodleUrl = (ink: string) => `url("data:image/svg+xml;utf8,${DOODLE_ART.replace('__INK__', ink.replace('#', ''))}")`;
const doodleBg = (base: string, ink: string) =>
  `background-color:${base};background-image:${doodleUrl(ink)};background-size:220px 220px;`;

const MARGIN_X = 46;
const BORDER_INSET = 22;
const HEAD_Y = 40;
const HEAD_RULE_Y = 62;
const PLATE_TOP = 76;
const PLATE_BOT = 62;
const PLATE_BOT_BARE = 40;
const FOLIO_Y = 36;
const PLATE_PAD = 11;

function diamondCss(color: string, size: number, op: number): string {
  return `width:${size}px;height:${size}px;background:${color};opacity:${op};transform:rotate(45deg);`;
}

function appendBorder(page: HTMLElement, key: string, th: BookTheme): void {
  if (key === 'none') return;
  const c = rgba(th.accent, 0.42);
  const faint = rgba(th.accent, 0.24);
  const add = (css: string) => {
    const d = document.createElement('div');
    d.style.cssText = 'position:absolute;pointer-events:none;' + css;
    page.appendChild(d);
  };
  const i = BORDER_INSET;
  const brackets = (len: number, weight: number) => {
    const corner = (pos: string) => add(`width:${len}px;height:${len}px;border:${weight}px solid ${c};${pos}`);
    corner(`top:${i - 9}px;left:${i - 9}px;border-right:none;border-bottom:none;`);
    corner(`top:${i - 9}px;right:${i - 9}px;border-left:none;border-bottom:none;`);
    corner(`bottom:${i - 9}px;left:${i - 9}px;border-right:none;border-top:none;`);
    corner(`bottom:${i - 9}px;right:${i - 9}px;border-left:none;border-top:none;`);
  };

  if (key === 'hairline') add(`inset:${i}px;border:1px solid ${c};`);
  else if (key === 'rounded') add(`inset:${i}px;border:1.5px solid ${c};border-radius:18px;`);
  else if (key === 'dotted') add(`inset:${i}px;border:2px dotted ${c};`);
  else if (key === 'double') {
    add(`inset:${i}px;border:1.6px solid ${c};`);
    add(`inset:${i + 6}px;border:0.8px solid ${faint};`);
  } else if (key === 'corners') {
    brackets(34, 2);

    const d = (pos: string) => add(pos + diamondCss(th.accent, 4, 0.5));
    d(`top:${i + 4}px;left:${i + 4}px;`); d(`top:${i + 4}px;right:${i + 4}px;`);
    d(`bottom:${i + 4}px;left:${i + 4}px;`); d(`bottom:${i + 4}px;right:${i + 4}px;`);
  } else if (key === 'ornate') {
    add(`inset:${i}px;border:1.5px solid ${c};`);
    add(`inset:${i + 7}px;border:0.8px solid ${faint};`);
    brackets(26, 1.4);

    const sq = (pos: string) => add(`width:5px;height:5px;background:${th.accent};opacity:.55;${pos}`);
    sq(`top:${i - 2}px;left:${i - 2}px;`); sq(`top:${i - 2}px;right:${i - 2}px;`);
    sq(`bottom:${i - 2}px;left:${i - 2}px;`); sq(`bottom:${i - 2}px;right:${i - 2}px;`);
    add(`top:${i - 4}px;left:50%;margin-left:-4px;` + diamondCss(th.accent, 8, 0.5));
    add(`bottom:${i - 4}px;left:50%;margin-left:-4px;` + diamondCss(th.accent, 8, 0.5));
    add(`left:${i - 4}px;top:50%;margin-top:-4px;` + diamondCss(th.accent, 8, 0.5));
    add(`right:${i - 4}px;top:50%;margin-top:-4px;` + diamondCss(th.accent, 8, 0.5));
  }
}

function gutterEl(recto: boolean): HTMLElement {
  const g = document.createElement('div');
  g.style.cssText = `position:absolute;top:0;bottom:0;${recto ? 'left:0;' : 'right:0;'}width:58px;pointer-events:none;`
    + `background:linear-gradient(${recto ? 90 : 270}deg,rgba(0,0,0,.085) 0%,rgba(0,0,0,.028) 40%,rgba(0,0,0,0) 100%);`;
  return g;
}

function headEl(chapter: string, who: string, recto: boolean, th: BookTheme, serif: boolean): HTMLElement {
  const h = document.createElement('div');
  h.style.cssText = `position:absolute;left:${MARGIN_X}px;right:${MARGIN_X}px;top:${HEAD_Y}px;`
    + 'display:flex;align-items:baseline;justify-content:space-between;gap:18px;';
  const chap = `<span style="font-family:${serif ? SERIF_STACK : SANS_STACK};font-style:italic;font-size:12.5px;`
    + `color:${th.accent};white-space:nowrap;">${escHtml(chapter)}</span>`;
  const name = `<span style="font-size:9px;letter-spacing:2.6px;text-transform:uppercase;color:${rgba(INK, 0.4)};`
    + `overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(who)}</span>`;
  h.innerHTML = recto ? name + chap : chap + name;
  return h;
}

function headRuleEl(th: BookTheme): HTMLElement {
  const w = document.createElement('div');
  w.style.cssText = `position:absolute;left:${MARGIN_X}px;right:${MARGIN_X}px;top:${HEAD_RULE_Y}px;height:1px;`
    + `background:${rgba(th.accent, 0.22)};`;
  const d = document.createElement('div');
  d.style.cssText = 'position:absolute;left:50%;top:-2px;margin-left:-2.5px;' + diamondCss(th.accent, 5, 0.45);
  w.appendChild(d);
  return w;
}

function folioEl(n: number, th: BookTheme, serif: boolean): HTMLElement {
  const f = document.createElement('div');
  f.style.cssText = `position:absolute;left:0;right:0;bottom:${FOLIO_Y}px;display:flex;`
    + 'align-items:center;justify-content:center;gap:11px;';
  const rule = `<span style="width:16px;height:1px;background:${rgba(th.accent, 0.4)};"></span>`;
  f.innerHTML = rule
    + `<span style="font-family:${serif ? SERIF_STACK : SANS_STACK};font-size:11.5px;letter-spacing:1px;`
    + `color:${rgba(INK, 0.55)};">${n}</span>` + rule;
  return f;
}

function plateEl(bgCss: string, folio: boolean): HTMLElement {
  const p = document.createElement('div');
  p.style.cssText = `position:absolute;left:${MARGIN_X}px;right:${MARGIN_X}px;top:${PLATE_TOP}px;`
    + `bottom:${folio ? PLATE_BOT : PLATE_BOT_BARE}px;border-radius:10px;overflow:hidden;box-sizing:border-box;`
    + `padding:${PLATE_PAD}px;border:1px solid rgba(0,0,0,.08);`
    + 'box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 5px 15px rgba(0,0,0,.10);' + bgCss;
  return p;
}

export interface BookMeta {
  title: string;
  meName: string | null;
  senders: string[];
  dateOrder: DateOrder;
  messages: Message[];
  mediaMap: Record<string, string>;
  msgCount: number;
  avatar?: string | null;
  wallpaper?: string;
}

const INK = '#111b21';
const SUBTLE = '#667781';
const WA_OUT = '#d9fdd3';
const WA_IN = '#ffffff';
const WA_TEAL = '#128c7e';
const WA_TICK = '#53bdeb';
const OUT_ACCENT = '#06cf9c';

function escHtml(s: string): string {
  return (s || '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
}

function monthOf(dayLabel: string): string {
  const parts = dayLabel.trim().split(/\s+/);
  return parts.length >= 3 ? parts.slice(1).join(' ') : dayLabel;
}

function chapterEl(monthYear: string, accent: string, serif: boolean): HTMLElement {
  const w = document.createElement('div');
  w.dataset.kind = 'chapter';
  w.style.cssText = 'display:flex;justify-content:center;margin:26px 0 16px;';
  const nameStyle = serif
    ? `font-family:${SERIF_STACK};font-size:17px;font-style:italic;letter-spacing:.3px;`
    : 'font-size:10.5px;letter-spacing:3px;font-weight:700;text-transform:uppercase;';
  const rule = `<span style="width:24px;height:1px;background:${accent};opacity:.55;"></span>`;
  w.innerHTML =
    `<span style="display:inline-flex;align-items:center;gap:12px;color:${accent};`
    + 'background:rgba(255,255,255,.74);border:1px solid rgba(0,0,0,.05);border-radius:20px;'
    + 'padding:6px 17px;box-shadow:0 1px 2px rgba(0,0,0,.07);">'
    + rule + `<span style="${nameStyle}">${escHtml(monthYear)}</span>` + rule
    + '</span>';
  return w;
}

function dayEl(text: string): HTMLElement {
  const w = document.createElement('div');
  w.dataset.kind = 'day';
  w.style.cssText = 'display:flex;justify-content:center;margin:14px 0 10px;';
  const p = document.createElement('span');
  p.textContent = text;
  p.style.cssText = 'background:#fff;color:#54656f;font-size:12px;font-weight:600;padding:5px 13px;'
    + 'border-radius:9px;box-shadow:0 1px 2px rgba(0,0,0,.12);';
  w.appendChild(p);
  return w;
}

function sysEl(text: string): HTMLElement {
  const w = document.createElement('div');
  w.style.cssText = 'display:flex;justify-content:center;margin:8px 0;';
  const p = document.createElement('span');
  p.innerHTML = P.formatText(P.stripMarks(text).trim());
  p.style.cssText = 'background:#fdf3d7;color:#7a6a3f;font-size:12px;padding:6px 13px;border-radius:9px;'
    + 'text-align:center;max-width:82%;line-height:1.45;box-shadow:0 1px 1px rgba(0,0,0,.06);';
  w.appendChild(p);
  return w;
}

function tailEl(out: boolean): HTMLElement {
  const t = document.createElement('div');
  t.style.cssText = 'position:absolute;top:0;width:0;height:0;'
    + (out
      ? `right:-8px;border-top:8px solid ${WA_OUT};border-right:8px solid transparent;`
      : `left:-8px;border-top:8px solid ${WA_IN};border-left:8px solid transparent;`);
  return t;
}

function tickMarkup(tick: number | undefined, onMedia: boolean): string {
  const tk = tick ?? 3;
  if (tk === 0) return '';
  const icon = tk === 1 ? '✓' : '✓✓';
  const color = onMedia ? (tk === 3 ? '#eafff2' : '#e0e0e0') : (tk === 3 ? WA_TICK : SUBTLE);
  return `<span style="color:${color};font-size:13px;">${icon}</span>`;
}

function msgEl(m: Message, out: boolean, isGroup: boolean, grouped: boolean, mediaMap: Record<string, string>): HTMLElement {
  const row = document.createElement('div');
  row.style.cssText = `display:flex;align-items:flex-end;gap:5px;justify-content:${out ? 'flex-end' : 'flex-start'};`
    + `margin:${grouped ? '2px' : '8px'} 0;`;

  if (isGroup && !out) {
    const av = document.createElement('div');
    if (grouped) {
      av.style.cssText = 'width:27px;height:27px;flex:0 0 auto;';
    } else {
      av.style.cssText = 'width:27px;height:27px;border-radius:50%;flex:0 0 auto;display:flex;'
        + `align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:600;`
        + `background:${P.avatarColor(m.sender || '')};`;
      av.textContent = P.initial(m.sender || '');
    }
    row.appendChild(av);
  }

  const att = m.call ? null : P.findAttachment(m.text);
  const emojiOnly = !m.call && !att && !P.PLACEHOLDERS.test(m.text) && !!P.emojiInfo(m.text);

  const bub = document.createElement('div');
  if (emojiOnly) {
    bub.style.cssText = 'position:relative;max-width:78%;background:transparent;padding:2px 4px;'
      + `color:${INK};line-height:1.4;`;
  } else {
    bub.style.cssText = `position:relative;max-width:78%;background:${out ? WA_OUT : WA_IN};border-radius:9px;`
      + `padding:6px 9px 8px;box-shadow:0 1px .6px rgba(0,0,0,.13);font-size:14.2px;line-height:1.4;`
      + `color:${INK};word-break:break-word;overflow-wrap:anywhere;`
      + (out ? 'margin-right:8px;' : 'margin-left:8px;');

    if (!grouped) {
      if (out) bub.style.borderTopRightRadius = '0';
      else bub.style.borderTopLeftRadius = '0';
      bub.appendChild(tailEl(out));
    }
  }

  if (m.forwarded) {
    const f = document.createElement('div');
    f.textContent = '↪ Forwarded';
    f.style.cssText = `font-size:12.5px;color:${SUBTLE};font-style:italic;margin-bottom:2px;`;
    bub.appendChild(f);
  }

  if (m.reply) {
    const rq = document.createElement('div');
    rq.style.cssText = `background:rgba(0,0,0,.05);border-left:3px solid ${out ? OUT_ACCENT : WA_TEAL};`
      + 'border-radius:5px;padding:4px 8px;margin-bottom:4px;overflow:hidden;';
    const nm = document.createElement('div');
    nm.textContent = m.reply.sender || '';
    nm.style.cssText = `font-size:12.5px;font-weight:600;color:${out ? OUT_ACCENT : WA_TEAL};`
      + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
    const tx = document.createElement('div');
    tx.textContent = m.reply.text || '📎 media';
    tx.style.cssText = `font-size:13px;color:${SUBTLE};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`;
    rq.appendChild(nm); rq.appendChild(tx); bub.appendChild(rq);
  }

  if (isGroup && !out && !grouped && m.sender) {
    const w = document.createElement('div');
    w.textContent = m.sender;
    w.style.cssText = `font-size:12.5px;font-weight:600;margin-bottom:2px;color:${P.avatarColor(m.sender)};`;
    bub.appendChild(w);
  }

  let mediaOnly = false;
  if (m.call) {
    const cr = document.createElement('div');
    cr.style.cssText = 'display:flex;align-items:center;gap:11px;min-width:150px;';
    const ic = document.createElement('div');
    ic.textContent = m.call.media === 'video' ? '📹' : '📞';
    ic.style.cssText = 'width:38px;height:38px;border-radius:50%;background:rgba(0,0,0,.08);display:flex;'
      + 'align-items:center;justify-content:center;font-size:18px;' + (m.call.missed ? 'color:#e5484d;' : '');
    const tw = document.createElement('div');
    tw.innerHTML = `<div style="font-size:14.5px;font-weight:600;color:${INK};">${escHtml(m.call.title)}</div>`
      + `<div style="font-size:12.5px;color:${SUBTLE};">${escHtml(m.call.sub)}</div>`;
    cr.appendChild(ic); cr.appendChild(tw); bub.appendChild(cr);
  } else if (att) {
    const fkey = att.split('/').pop()!.toLowerCase();
    const url = mediaMap[fkey];
    const ext = (fkey.match(/\.([a-z0-9]+)$/) || [])[1] || '';
    const cap = P.extractCaption(m.text, att);
    if (url && /^(jpe?g|png|gif|webp|bmp|heic)$/.test(ext)) {
      const im = document.createElement('img');
      im.crossOrigin = 'anonymous';
      im.src = url;
      im.style.cssText = 'max-width:100%;max-height:360px;border-radius:7px;display:block;object-fit:cover;';
      bub.appendChild(im);
      if (!cap) mediaOnly = true;
    } else {
      const ph = document.createElement('div');
      ph.textContent = P.mediaLabel(ext);
      ph.style.cssText = `color:${SUBTLE};font-style:italic;`;
      bub.appendChild(ph);
    }
    if (cap) {
      const cp = document.createElement('span');
      cp.style.cssText = 'display:block;margin-top:4px;';
      cp.innerHTML = P.formatText(cap);
      bub.appendChild(cp);
    }
  } else if (P.PLACEHOLDERS.test(m.text)) {
    const ph = document.createElement('div');
    ph.textContent = P.placeholderLabel(m.text);
    ph.style.cssText = `color:${SUBTLE};font-style:italic;`;
    bub.appendChild(ph);
  } else if (emojiOnly) {
    const tx = document.createElement('div');
    tx.textContent = P.stripMarks(m.text);
    tx.style.cssText = 'font-size:2.7em;line-height:1.15;';
    bub.appendChild(tx);
  } else {
    const tx = document.createElement('span');
    tx.style.display = 'inline';
    tx.innerHTML = P.formatText(m.text);
    bub.appendChild(tx);
  }

  if (m.reactions && m.reactions.length) {
    bub.style.marginBottom = '11px';
    const rc = document.createElement('span');
    rc.textContent = m.reactions.join(' ');
    rc.style.cssText = `position:absolute;bottom:-11px;right:8px;background:${WA_IN};border-radius:12px;`
      + 'padding:1px 6px;font-size:12px;box-shadow:0 1px 2px rgba(0,0,0,.18);white-space:nowrap;';
    bub.appendChild(rc);
  }

  const meta = document.createElement('div');
  if (mediaOnly) {
    meta.style.cssText = 'position:absolute;right:12px;bottom:9px;display:flex;align-items:center;gap:3px;'
      + 'font-size:11px;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.45);z-index:2;';
  } else {
    meta.style.cssText = `font-size:11px;color:${SUBTLE};float:right;margin:2px 0 -2px 8px;`
      + 'display:flex;align-items:center;gap:3px;';
  }
  meta.innerHTML = `<span>${escHtml(P.shortTime(m.time))}</span>${out ? tickMarkup(m.tick, mediaOnly) : ''}`;
  bub.appendChild(meta);

  row.appendChild(bub);
  return row;
}

export type BookProgress = (done: number, total: number) => void;

const breathe = () => new Promise<void>((r) => { setTimeout(r, 0); });

export async function exportBook(meta: BookMeta, config?: BookConfig, onProgress?: BookProgress): Promise<void> {
  const { meName, senders, dateOrder, messages, mediaMap, avatar } = meta;
  if (!messages.length) throw new Error('Open a chat first.');
  const cfg = config || defaultBookConfig(meta.title);
  const th = themeOf(cfg.themeKey);
  const title = cfg.title || meta.title;
  const headFont = cfg.serif ? SERIF_STACK : SANS_STACK;
  const isGroup = senders.length > 2;

  const sz = sizeOf(cfg.sizeKey);
  const PAGE_W = 794;
  const PAGE_H = Math.round(PAGE_W * sz.h / sz.w);

  const uniqDates = new Set(messages.filter((m) => m.date).map((m) => m.date));
  const days = uniqDates.size;
  let mediaCount = 0;
  for (const m of messages) if (!m.call && P.findAttachment(m.text)) mediaCount++;

  const book = document.createElement('div');
  book.style.cssText = `position:fixed;left:-10000px;top:0;width:${PAGE_W}px;background:${th.paper};`
    + "font-family:'Segoe UI',system-ui,-apple-system,'Noto Sans','Noto Sans Devanagari',sans-serif;color:" + INK + ';';

  const firstDate = messages.find((m) => m.date)?.date;
  const lastDate = [...messages].reverse().find((m) => m.date)?.date;
  const range = firstDate && lastDate ? `${P.formatDay(firstDate, dateOrder)}  —  ${P.formatDay(lastDate, dateOrder)}` : '';
  const others = senders.filter((s) => s !== meName);
  const between = isGroup ? senders.slice(0, 5).join(', ')
    : (meName && others[0] ? `${others[0]}  &  ${meName}` : title);

  const SPINE = 30;
  const foilRule = (w: number, op: number, mt = 0) =>
    `<div style="width:${w}px;height:1px;background:${th.foil};opacity:${op};margin-top:${mt}px;"></div>`;

  const portrait = (cfg.showAvatar && avatar)
    ? `<div style="position:relative;width:96px;height:96px;margin-bottom:46px;">`
      + `<img src="${escHtml(avatar)}" crossorigin="anonymous" style="width:96px;height:96px;border-radius:50%;object-fit:cover;display:block;"/>`
      + `<div style="position:absolute;inset:0;border:2px solid ${th.foil};opacity:.85;border-radius:50%;"></div>`
      + `<div style="position:absolute;inset:-9px;border:1px solid ${th.foil};opacity:.45;border-radius:50%;"></div>`
      + `</div>`
    : '';

  const colophon = cfg.showStats
    ? [`${meta.msgCount.toLocaleString()} messages`,
       `${days.toLocaleString()} ${days === 1 ? 'day' : 'days'}`,
       mediaCount ? `${mediaCount.toLocaleString()} photograph${mediaCount === 1 ? '' : 's'}` : '',
      ].filter(Boolean).join('   ·   ')
    : '';

  const titleCss = cfg.serif
    ? `font-family:${SERIF_STACK};font-size:47px;font-weight:400;letter-spacing:.4px;line-height:1.16;`
    : `font-family:${SANS_STACK};font-size:30px;font-weight:600;letter-spacing:6px;text-transform:uppercase;line-height:1.35;`;
  const deboss = th.light ? '0 1px 0 rgba(255,255,255,.75)' : '0 1px 0 rgba(0,0,0,.45)';

  const cover = document.createElement('div');
  cover.style.cssText = `position:relative;height:${PAGE_H}px;box-sizing:border-box;overflow:hidden;`
    + `background:${th.cloth};color:${th.foil};`;
  cover.innerHTML =
    `<div style="position:absolute;inset:0;${weaveCss(th)}"></div>`
    + `<div style="position:absolute;inset:0;${vignetteCss(th)}"></div>`
    + `<div style="position:absolute;left:0;top:0;bottom:0;width:${SPINE}px;background:linear-gradient(90deg,`
    + `${th.clothEdge} 0%,${th.clothEdge} 55%,rgba(0,0,0,.20) 92%,rgba(255,255,255,.07) 100%);"></div>`
    + `<div style="position:absolute;top:36px;right:36px;bottom:36px;left:${SPINE + 26}px;border:1.2px solid ${th.foil};opacity:.5;"></div>`
    + `<div style="position:absolute;top:42px;right:42px;bottom:42px;left:${SPINE + 32}px;border:.7px solid ${th.foil};opacity:.28;"></div>`

    + `<div style="position:absolute;inset:0;padding:0 76px 156px ${SPINE + 76}px;box-sizing:border-box;`
    + `display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;">`
    + portrait
    + foilRule(52, .5)
    + `<div style="${titleCss}margin-top:28px;max-width:520px;text-shadow:${deboss};">${escHtml(title)}</div>`
    + (cfg.subtitle
      ? `<div style="font-family:${SERIF_STACK};font-style:italic;font-size:16px;opacity:.6;margin-top:16px;">${escHtml(cfg.subtitle)}</div>`
      : '')
    + foilRule(52, .5, 28)
    + `<div style="font-size:12.5px;letter-spacing:3.4px;text-transform:uppercase;opacity:.82;margin-top:28px;`
    + `max-width:440px;line-height:1.8;">${escHtml(between)}</div>`
    + `</div>`
    + `<div style="position:absolute;left:${SPINE + 76}px;right:76px;bottom:76px;text-align:center;">`
    + (range ? `<div style="font-size:10.5px;letter-spacing:2.6px;text-transform:uppercase;opacity:.56;">${escHtml(range)}</div>` : '')
    + (colophon ? `<div style="font-size:9.5px;letter-spacing:1.8px;text-transform:uppercase;opacity:.4;margin-top:15px;">${escHtml(colophon)}</div>` : '')
    + `</div>`;
  if (cfg.showCover) book.appendChild(cover);

  const titlePage = document.createElement('div');
  titlePage.style.cssText = `position:relative;height:${PAGE_H}px;box-sizing:border-box;display:flex;flex-direction:column;`
    + `align-items:center;justify-content:center;text-align:center;padding:120px 90px;background:${th.paper};color:${INK};`;
  titlePage.innerHTML =
    `<div style="font-size:24px;color:${th.accent};margin-bottom:26px;">❦</div>`
    + `<div style="font-family:${headFont};font-size:40px;font-weight:${cfg.serif ? 700 : 800};line-height:1.2;">${escHtml(title)}</div>`
    + `<div style="width:60px;height:1px;background:${th.accent};opacity:.5;margin:22px 0;"></div>`
    + `<div style="font-size:17px;color:#3a4a52;">${escHtml(between)}</div>`
    + (range ? `<div style="font-size:12px;color:${SUBTLE};margin-top:12px;letter-spacing:2px;text-transform:uppercase;">${escHtml(range)}</div>` : '')
    + (cfg.dedication
      ? `<div style="font-family:${headFont};font-style:italic;font-size:17px;color:#4a5a62;margin-top:64px;max-width:70%;line-height:1.6;">${escHtml(cfg.dedication)}</div>`
      : '');
  titlePage.appendChild(gutterEl(true));
  appendBorder(titlePage, cfg.borderKey, th);

  const phone = cfg.phoneFrame;
  const twoCol = cfg.twoColumns && !phone;
  const PHONE_W = 384, FRAME_PAD = 11, HEADER_H = 52, STATUS_H = 20;
  const COL_GAP = 28;
  const PLATE_W = PAGE_W - 2 * MARGIN_X - 2 * PLATE_PAD;
  const colW = Math.floor((PLATE_W - COL_GAP) / 2);
  const measureW = phone ? PHONE_W : (twoCol ? colW : PLATE_W);
  const content = document.createElement('div');
  content.style.cssText = `width:${measureW}px;box-sizing:border-box;padding:${phone ? '6px 8px 10px' : '0'};`;
  let lastD: string | null = null, prevSender: string | null = null, lastMonth: string | null = null;
  let curMonth = '';

  const push = (el: HTMLElement) => { el.dataset.month = curMonth; content.appendChild(el); };
  for (const m of messages) {
    if (m.date !== lastD) {
      const dl = P.formatDay(m.date, dateOrder);
      const mo = monthOf(dl);
      curMonth = mo;
      if (cfg.showChapters && mo !== lastMonth) { push(chapterEl(mo, th.accent, cfg.serif)); lastMonth = mo; }
      push(dayEl(dl)); lastD = m.date; prevSender = null;
    }
    if (m.system || !m.sender) { push(sysEl(m.text)); prevSender = null; continue; }
    const out = m.sender === meName;
    push(msgEl(m, out, isGroup, prevSender === m.sender, mediaMap));
    prevSender = m.sender;
  }
  book.appendChild(content);
  document.body.appendChild(book);

  try {

    const imgs = Array.from(book.querySelectorAll('img'));
    await Promise.all(imgs.map((img) => img.complete && img.naturalWidth
      ? Promise.resolve()
      : new Promise<void>((res) => {
          const done = () => res();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
          setTimeout(done, 8000);
        })));

    const cTop = content.getBoundingClientRect().top;

    const plateBottom = cfg.showPageNumbers ? PLATE_BOT : PLATE_BOT_BARE;
    const plateInnerH = PAGE_H - PLATE_TOP - plateBottom - 2 * PLATE_PAD;
    const phOuterH = PAGE_H - PLATE_TOP - plateBottom;
    const phScreenH = phOuterH - 2 * FRAME_PAD;
    const phBodyH = phScreenH - HEADER_H - STATUS_H;
    const contentPageH = phone ? phBodyH - 20 : plateInnerH;
    const rows = Array.from(content.children) as HTMLElement[];
    const pageGroups: HTMLElement[][] = [];
    let cur: HTMLElement[] = [];
    let pageTop = rows.length ? rows[0].getBoundingClientRect().top - cTop : 0;
    for (const r of rows) {
      const bottom = r.getBoundingClientRect().bottom - cTop;
      if (cur.length && bottom - pageTop > contentPageH) {
        pageGroups.push(cur); cur = []; pageTop = r.getBoundingClientRect().top - cTop;
      }
      cur.push(r);
    }
    if (cur.length) pageGroups.push(cur);

    const pages: HTMLElement[][][] = twoCol
      ? pageGroups.reduce<HTMLElement[][][]>((acc, g, idx) => {
          if (idx % 2 === 0) acc.push([g]); else acc[acc.length - 1].push(g);
          return acc;
        }, [])
      : pageGroups.map((g) => [g]);

    const chapters: { month: string; page: number }[] = [];
    pages.forEach((cols, i) => {
      for (const col of cols) for (const row of col) {
        const m = row.dataset.month;
        if (m && !chapters.some((c) => c.month === m)) chapters.push({ month: m, page: i + 1 });
      }
    });
    const wantContents = cfg.showContents && cfg.showPageNumbers && chapters.length > 1;

    const tocLeader = `border-bottom:1px dotted ${rgba(INK, 0.3)};`;
    const tocEntryHtml = ({ month, page: pg }: { month: string; page: number }) =>
      '<div style="display:flex;align-items:baseline;gap:10px;margin:0 0 19px;">'
      + `<span style="font-family:${headFont};font-size:16px;${cfg.serif ? 'font-style:italic;' : ''}white-space:nowrap;">${escHtml(month)}</span>`
      + `<span style="flex:1;${tocLeader}transform:translateY(-4px);"></span>`
      + `<span style="font-family:${headFont};font-size:14px;color:${rgba(INK, 0.62)};">${pg}</span>`
      + '</div>';
    const tocSlices: { month: string; page: number }[][] = [];
    if (wantContents) {
      const TOC_PAD = 118, TOC_HEADER_H = 110;

      const probe = document.createElement('div');
      probe.style.cssText = `position:fixed;left:-10000px;top:0;width:${PAGE_W - 192}px;visibility:hidden;`;
      probe.innerHTML = tocEntryHtml(chapters[0]);
      document.body.appendChild(probe);
      const entryH = ((probe.firstElementChild as HTMLElement)?.offsetHeight || 21) + 19;
      probe.remove();
      const avail = PAGE_H - TOC_PAD * 2;
      const firstCap = Math.max(1, Math.floor((avail - TOC_HEADER_H) / entryH));
      const contCap = Math.max(1, Math.floor(avail / entryH));
      tocSlices.push(chapters.slice(0, firstCap));
      for (let idx = firstCap; idx < chapters.length; idx += contCap) tocSlices.push(chapters.slice(idx, idx + contCap));
    }

    const html2canvas = (await import('html2canvas')).default;
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ unit: 'mm', format: [sz.w, sz.h], orientation: sz.w > sz.h ? 'landscape' : 'portrait' });
    pdf.setProperties({ title, subject: cfg.subtitle || 'A conversation keepsake', author: between, creator: 'Chat Tree' });
    let pageAdded = false;

    const totalPages = pages.length + (cfg.showCover ? 1 : 0) + (cfg.showTitlePage ? 1 : 0)
      + tocSlices.length + (cfg.showClosing ? 1 : 0);
    let drawn = 0;
    onProgress?.(0, totalPages);

    const addPage = async (el: HTMLElement) => {
      const c = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: th.paper, logging: false });
      if (pageAdded) pdf.addPage([sz.w, sz.h], sz.w > sz.h ? 'landscape' : 'portrait');
      pageAdded = true;
      const imgH = sz.w * (c.height / c.width);
      pdf.addImage(c.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, sz.w, Math.min(imgH, sz.h));
      onProgress?.(++drawn, totalPages);
      await breathe();
    };

    if (cfg.showCover) await addPage(cover);
    if (cfg.showTitlePage) { book.appendChild(titlePage); await addPage(titlePage); titlePage.remove(); }

    for (let s = 0; s < tocSlices.length; s++) {
      const toc = document.createElement('div');
      toc.style.cssText = `position:relative;width:${PAGE_W}px;height:${PAGE_H}px;box-sizing:border-box;`
        + `overflow:hidden;background:${th.paper};color:${INK};padding:118px 96px;`;
      const header = s === 0
        ? `<div style="text-align:center;font-family:${headFont};font-size:26px;letter-spacing:${cfg.serif ? '1px' : '4px'};`
          + `${cfg.serif ? '' : 'text-transform:uppercase;font-weight:700;'}">Contents</div>`
          + `<div style="width:52px;height:1px;background:${th.accent};opacity:.5;margin:20px auto 42px;"></div>`
        : '';
      toc.innerHTML = header + tocSlices[s].map(tocEntryHtml).join('');
      toc.appendChild(gutterEl(false));
      appendBorder(toc, cfg.borderKey, th);
      book.appendChild(toc);
      await addPage(toc);
      toc.remove();
    }
    content.remove();

    const total = pages.length;

    const plateBg = cfg.showWallpaper
      ? (meta.wallpaper ? `background:${meta.wallpaper};` : doodleBg(th.chatBg, th.doodleInk))
      : `background:${th.chatBg};`;
    for (let i = 0; i < total; i++) {
      const cols = pages[i];
      const recto = i % 2 === 0;
      const first = cols[0][0];
      const month = first?.dataset.month || '';

      const kind = first?.dataset.kind;
      const chapter = month && kind !== 'day' && kind !== 'chapter' ? `${month} (cont.)` : month;
      const page = document.createElement('div');
      page.style.cssText = `position:relative;width:${PAGE_W}px;height:${PAGE_H}px;box-sizing:border-box;`
        + `overflow:hidden;background:${th.paper};`;

      page.appendChild(gutterEl(recto));
      appendBorder(page, cfg.borderKey, th);
      page.appendChild(headEl(chapter, between, recto, th, cfg.serif));
      page.appendChild(headRuleEl(th));

      if (phone) {

        const bodyBg = meta.wallpaper ? `background:${meta.wallpaper};` : doodleBg(th.chatBg, th.doodleInk);
        const frame = document.createElement('div');
        frame.style.cssText = `position:absolute;left:50%;top:${PLATE_TOP}px;transform:translateX(-50%);`
          + `width:${PHONE_W + 2 * FRAME_PAD}px;height:${phOuterH}px;background:#0b1013;`
          + `border-radius:44px;padding:${FRAME_PAD}px;box-sizing:border-box;box-shadow:0 16px 36px rgba(0,0,0,.28);`;
        const screen = document.createElement('div');
        screen.style.cssText = `position:relative;width:${PHONE_W}px;height:${phScreenH}px;border-radius:34px;overflow:hidden;`
          + `display:flex;flex-direction:column;background:${th.chatBg};`;

        const status = document.createElement('div');
        status.style.cssText = `position:relative;height:${STATUS_H}px;flex:0 0 auto;background:#075e54;`;
        const notch = document.createElement('div');
        notch.style.cssText = 'position:absolute;top:3px;left:50%;transform:translateX(-50%);width:98px;height:14px;background:#0b1013;border-radius:10px;';
        status.appendChild(notch);
        const header = document.createElement('div');
        header.style.cssText = `height:${HEADER_H}px;flex:0 0 auto;display:flex;align-items:center;gap:9px;padding:0 12px;box-sizing:border-box;background:#075e54;color:#fff;`;
        const ava = (cfg.showAvatar && avatar)
          ? `<img src="${escHtml(avatar)}" crossorigin="anonymous" style="width:34px;height:34px;border-radius:50%;object-fit:cover;"/>`
          : `<span style="width:34px;height:34px;border-radius:50%;background:#ffffff33;display:inline-flex;align-items:center;justify-content:center;font-size:15px;font-weight:600;">${escHtml(P.initial(title))}</span>`;
        header.innerHTML = `<span style="font-size:22px;line-height:1;">‹</span>${ava}`
          + `<div style="flex:1;min-width:0;"><div style="font-size:15px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(title)}</div>`
          + '<div style="font-size:11px;opacity:.85;">online</div></div>'
          + '<span style="font-size:15px;opacity:.9;">📹</span><span style="font-size:15px;opacity:.9;">📞</span><span style="font-size:17px;opacity:.9;">⋮</span>';
        const body = document.createElement('div');
        body.style.cssText = 'flex:1;overflow:hidden;padding:9px 8px 10px;box-sizing:border-box;' + bodyBg;
        for (const el of cols[0]) body.appendChild(el);
        screen.appendChild(status); screen.appendChild(header); screen.appendChild(body);
        frame.appendChild(screen);
        page.appendChild(frame);
      } else {
        const plate = plateEl(plateBg, cfg.showPageNumbers);
        const colWrap = document.createElement('div');
        colWrap.style.cssText = `display:flex;gap:${COL_GAP}px;height:100%;align-items:flex-start;position:relative;`;
        if (twoCol && cols.length === 2) {
          const div = document.createElement('div');
          div.style.cssText = 'position:absolute;left:50%;top:0;bottom:0;width:1px;transform:translateX(-50%);'
            + 'background:rgba(0,0,0,.10);box-shadow:1px 0 0 rgba(255,255,255,.45);';
          colWrap.appendChild(div);
        }
        cols.forEach((colRows) => {
          const col = document.createElement('div');
          col.style.cssText = twoCol ? `width:${colW}px;flex:0 0 auto;` : 'flex:1;min-width:0;';
          for (const el of colRows) col.appendChild(el);
          colWrap.appendChild(col);
        });
        plate.appendChild(colWrap);
        page.appendChild(plate);
      }
      if (cfg.showPageNumbers) page.appendChild(folioEl(i + 1, th, cfg.serif));
      book.appendChild(page);
      await addPage(page);
      page.remove();
    }

    if (cfg.showClosing) {

      const end = document.createElement('div');
      end.style.cssText = `position:relative;height:${PAGE_H}px;box-sizing:border-box;overflow:hidden;`
        + `background:${th.cloth};color:${th.foil};`;
      end.innerHTML =
        `<div style="position:absolute;inset:0;${weaveCss(th)}"></div>`
        + `<div style="position:absolute;inset:0;${vignetteCss(th)}"></div>`
        + `<div style="position:absolute;left:0;top:0;bottom:0;width:${SPINE}px;background:linear-gradient(90deg,`
        + `${th.clothEdge} 0%,${th.clothEdge} 55%,rgba(0,0,0,.20) 92%,rgba(255,255,255,.07) 100%);"></div>`
        + `<div style="position:absolute;top:36px;right:36px;bottom:36px;left:${SPINE + 26}px;border:1.2px solid ${th.foil};opacity:.5;"></div>`
        + `<div style="position:absolute;inset:0;padding:0 76px 90px ${SPINE + 76}px;box-sizing:border-box;`
        + `display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;">`
        + foilRule(52, .5)
        + `<div style="font-family:${SERIF_STACK};font-size:30px;font-weight:400;margin-top:28px;text-shadow:${deboss};">The end — for now</div>`
        + `<div style="font-size:10.5px;letter-spacing:2.6px;text-transform:uppercase;opacity:.56;margin-top:26px;line-height:1.9;max-width:380px;">`
        + `${escHtml(meta.msgCount.toLocaleString())} messages across ${escHtml(days.toLocaleString())} ${days === 1 ? 'day' : 'days'}</div>`
        + foilRule(52, .5, 30)
        + `</div>`
        + `<div style="position:absolute;left:${SPINE + 76}px;right:76px;bottom:76px;text-align:center;`
        + `font-size:9.5px;letter-spacing:2px;text-transform:uppercase;opacity:.4;">Made with Chat Tree</div>`;
      book.appendChild(end);
      await addPage(end);
      end.remove();
    }

    const safe = (title || 'chat').replace(/[^a-z0-9._-]+/gi, '_');
    pdf.save(`${safe}-book.pdf`);
  } finally {
    document.body.removeChild(book);
  }
}
