/**
 * Book Studio configuration: themes, page borders, and the saved-template store.
 * Everything the export needs to render a personalised keepsake book.
 */

/**
 * A cover is a piece of bookcloth with the type foil-stamped into it —
 * not a gradient card. `cloth` is the weave colour, `clothEdge` darkens the
 * vignette and spine, and everything printed on the cover is `foil`.
 *
 * The inside of the book is a different material: `paper` is the printed page,
 * and the chat sits on a `chatBg` plate patterned in `doodleInk`. Those two
 * are what make an Oxblood book read differently from a Deep Ocean one once
 * you turn past the cover.
 */
export interface BookTheme {
  key: string;
  name: string;
  cloth: string;      // bookcloth base colour
  clothEdge: string;  // vignette + spine shade
  foil: string;       // stamped type, rules and frame
  accent: string;     // running heads, chapter openers, folios, page frames
  paper: string;      // the printed page the plate is mounted on
  chatBg: string;     // the chat plate, a shade deeper than the paper
  doodleInk: string;  // the wallpaper doodle drawn on that plate
  light?: boolean;    // a pale cloth stamped in dark foil
}

export const BOOK_THEMES: BookTheme[] = [
  { key: 'whatsapp', name: 'Forest Cloth',
    cloth: '#0e3a33', clothEdge: '#06231e', foil: '#d7c79a', accent: '#0b6b5f',
    paper: '#efeae2', chatBg: '#e7e0d3', doodleInk: '#d0c4b1' },
  { key: 'rose', name: 'Oxblood (Love)',
    cloth: '#5e1226', clothEdge: '#350a16', foil: '#e7bfae', accent: '#c9184a',
    paper: '#faf1f0', chatBg: '#f3e2e2', doodleInk: '#dcc0bd' },
  { key: 'midnight', name: 'Midnight Navy',
    cloth: '#141c33', clothEdge: '#080c1a', foil: '#c6cde0', accent: '#5566a8',
    paper: '#eef0f6', chatBg: '#e3e7f0', doodleInk: '#c2c9dc' },
  { key: 'sunset', name: 'Burnt Clay',
    cloth: '#6b2716', clothEdge: '#3d150c', foil: '#e6bf7f', accent: '#c14a24',
    paper: '#fbf0e8', chatBg: '#f4e5d6', doodleInk: '#dfc2a4' },
  { key: 'ocean', name: 'Deep Ocean',
    cloth: '#0d2f47', clothEdge: '#061a29', foil: '#bcd0dd', accent: '#1462a0',
    paper: '#e9f1f6', chatBg: '#dee8f0', doodleInk: '#bbcfdc' },
  { key: 'cream', name: 'Ivory Linen',
    cloth: '#eee6d6', clothEdge: '#ddd2ba', foil: '#7d5f2c', accent: '#a8842c',
    paper: '#faf5ea', chatBg: '#f1e9d8', doodleInk: '#dbceb2', light: true },
];

/** rgba() from a #rgb / #rrggbb hex, for tinting rules and frames. */
export function rgba(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/**
 * A fine woven texture. Real bookcloth is a crosshatch you can barely see at
 * arm's length, so keep the pitch tight and the contrast almost nothing —
 * anything stronger reads as graph paper.
 */
export const WEAVE_TILE = 5;
export function weaveUrl(th: BookTheme): string {
  const hex = th.light ? '3a2f1c' : 'ffffff';
  const op = th.light ? '0.05' : '0.035';
  const t = WEAVE_TILE;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${t}' height='${t}'>`
    + `<g stroke='%23${hex}' stroke-opacity='${op}' stroke-width='0.5'>`
    + `<path d='M0 .25h${t}'/><path d='M.25 0v${t}'/></g></svg>`;
  return `url("data:image/svg+xml;utf8,${svg}")`;
}
export function weaveCss(th: BookTheme): string {
  return `background-image:${weaveUrl(th)};background-size:${WEAVE_TILE}px ${WEAVE_TILE}px;`;
}

/** The darkening vignette that gives the cloth its depth. */
export function vignetteBg(th: BookTheme): string {
  const shade = th.light ? 'rgba(90,70,40,.16)' : 'rgba(0,0,0,.42)';
  return `radial-gradient(118% 86% at 50% 38%,rgba(0,0,0,0) 44%,${shade} 100%)`;
}
export function vignetteCss(th: BookTheme): string {
  return `background:${vignetteBg(th)};`;
}

/** Swatch used in Book Studio's theme picker. */
export function swatchCss(th: BookTheme): string {
  return `linear-gradient(135deg,${th.cloth} 0%,${th.cloth} 55%,${th.clothEdge} 100%)`;
}

export interface BookSize { key: string; name: string; w: number; h: number }  // mm, portrait
export const BOOK_SIZES: BookSize[] = [
  { key: 'a4', name: 'A4', w: 210, h: 297 },
  { key: 'a5', name: 'A5 (book)', w: 148, h: 210 },
  { key: 'letter', name: 'Letter', w: 216, h: 279 },
  { key: 'sixnine', name: '6×9 in', w: 152, h: 229 },
  { key: 'square', name: 'Square', w: 210, h: 210 },
  { key: 'photo57', name: 'Photo 5×7', w: 127, h: 178 },
  { key: 'a6', name: 'A6 pocket', w: 105, h: 148 },
];
export function sizeOf(key: string): BookSize {
  return BOOK_SIZES.find((s) => s.key === key) || BOOK_SIZES[0];
}

export interface BookBorder { key: string; name: string }
export const BOOK_BORDERS: BookBorder[] = [
  { key: 'none', name: 'None' },
  { key: 'hairline', name: 'Hairline' },
  { key: 'double', name: 'Double rule' },
  { key: 'ornate', name: 'Ornate' },
  { key: 'rounded', name: 'Rounded' },
  { key: 'corners', name: 'Corner marks' },
  { key: 'dotted', name: 'Dotted' },
];

export interface BookConfig {
  title: string;
  subtitle: string;
  dedication: string;
  themeKey: string;
  borderKey: string;
  sizeKey: string;        // page size (A4, A5, Square, …)
  serif: boolean;         // elegant serif typography on the book chrome
  showWallpaper: boolean; // put the chat wallpaper behind the pages
  phoneFrame: boolean;    // render the chat inside a phone mockup
  twoColumns: boolean;    // two chat columns per page (fewer pages)
  showCover: boolean;
  showTitlePage: boolean; // inner title page after the cover
  showContents: boolean;  // contents page listing each month and its page
  showAvatar: boolean;
  showStats: boolean;
  showChapters: boolean;
  showPageNumbers: boolean;
  showClosing: boolean;
}

/** Serif = premium/print feel; sans = modern. Chat bubbles always stay sans. */
export const SERIF_STACK = "Georgia,'Times New Roman','Noto Serif',serif";
export const SANS_STACK = "'Segoe UI',system-ui,-apple-system,'Noto Sans','Noto Sans Devanagari',sans-serif";

export function defaultBookConfig(title: string): BookConfig {
  return {
    title, subtitle: 'A conversation keepsake', dedication: '',
    themeKey: 'whatsapp', borderKey: 'hairline', sizeKey: 'a4', serif: true, showWallpaper: true,
    phoneFrame: false, twoColumns: false,
    showCover: true, showTitlePage: true, showContents: true, showAvatar: true, showStats: true,
    showChapters: true, showPageNumbers: true, showClosing: true,
  };
}

export function themeOf(key: string): BookTheme {
  return BOOK_THEMES.find((t) => t.key === key) || BOOK_THEMES[0];
}

/* ---------------- Saved templates (localStorage) ---------------- */
const TPL_KEY = 'chattree_book_templates';
export interface BookTemplate { name: string; config: BookConfig }

export function loadTemplates(): BookTemplate[] {
  try {
    const raw = localStorage.getItem(TPL_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
export function saveTemplate(name: string, config: BookConfig): BookTemplate[] {
  const list = loadTemplates().filter((t) => t.name !== name);
  list.unshift({ name, config: { ...config } });
  const capped = list.slice(0, 20);
  try { localStorage.setItem(TPL_KEY, JSON.stringify(capped)); } catch { /* ignore quota */ }
  return capped;
}
export function deleteTemplate(name: string): BookTemplate[] {
  const list = loadTemplates().filter((t) => t.name !== name);
  try { localStorage.setItem(TPL_KEY, JSON.stringify(list)); } catch { /* ignore */ }
  return list;
}
