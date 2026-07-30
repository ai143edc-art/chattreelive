/**
 * Translation helper.
 *
 * By default translateBatch() uses the free browser-side MyMemory provider —
 * no key, works out of the box. Adding a contact email (VITE_MYMEMORY_EMAIL)
 * raises MyMemory's free anonymous quota from ~5k to ~50k words/day.
 *
 * OPTIONAL server-side upgrade: deploy the Gemini edge function in
 * `supabase/functions/translate/`, set GEMINI_API_KEY, then set
 * VITE_USE_EDGE_TRANSLATE=1 — translateBatch will use it (higher quality,
 * key stays server-side) and automatically fall back to MyMemory if it errors.
 */

import { sb } from './supabase';

export type Lang2 = 'en' | 'hi';
export type FromLang = Lang2 | 'auto';

// A contact email lifts MyMemory's free anonymous limit ~10x. The app already
// exposes this address publicly (Privacy/Terms), so there is nothing new leaked.
const MM_EMAIL = (import.meta.env.VITE_MYMEMORY_EMAIL as string | undefined) || 'vikkuedc143@gmail.com';
// Only route through the Gemini edge function when it's actually deployed.
const USE_EDGE = String(import.meta.env.VITE_USE_EDGE_TRANSLATE || '') === '1';

/** Cheap script check: any Devanagari char ⇒ treat as Hindi, else English. */
export function detectLang(s: string): Lang2 {
  return /[ऀ-ॿ]/.test(s) ? 'hi' : 'en';
}

interface MMResp {
  responseData?: { translatedText?: string };
  responseStatus?: number | string;
}

/** Translate a single string via MyMemory. Returns the original text on empty
 *  / same-language. Throws a friendly message on quota / network failure. */
export async function translateText(text: string, from: FromLang, to: Lang2): Promise<string> {
  const q = text.trim();
  if (!q) return text;
  const src = from === 'auto' ? detectLang(q) : from;
  if (src === to) return text;

  let url = 'https://api.mymemory.translated.net/get?q='
    + encodeURIComponent(q) + '&langpair=' + encodeURIComponent(`${src}|${to}`);
  if (MM_EMAIL) url += '&de=' + encodeURIComponent(MM_EMAIL);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  let j: MMResp;
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error('Translation service is unavailable right now.');
    j = (await r.json()) as MMResp;
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new Error('Translation timed out. Please try again.');
    throw e;
  } finally {
    clearTimeout(timer);
  }

  const out = j.responseData?.translatedText || '';
  if (/MYMEMORY WARNING|QUOTA|LIMIT REACHED|too many|MYMEMORY ERROR/i.test(out)) {
    throw new Error('Daily free translation limit reached. Please try again later.');
  }
  return out || text;
}

/** Try the Gemini edge function for a chunk. Returns null if it isn't available
 *  or gives back an unusable shape, so the caller can fall back to MyMemory. */
async function translateViaEdge(texts: string[], to: Lang2): Promise<string[] | null> {
  try {
    const { data, error } = await sb.functions.invoke('translate', { body: { texts, to } });
    if (error) return null;
    const tr = (data as { translations?: unknown } | null)?.translations;
    if (Array.isArray(tr) && tr.length === texts.length && tr.every((x) => typeof x === 'string')) {
      return tr as string[];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Translate many strings in order. Same-language / empty strings pass through
 * untouched. Uses MyMemory by default (identical strings translated once);
 * routes through the edge function first only when VITE_USE_EDGE_TRANSLATE=1.
 * `onProgress` reports how many have completed so the UI can show a live count.
 */
export async function translateBatch(
  items: string[],
  from: FromLang,
  to: Lang2,
  onProgress?: (done: number, total: number) => void,
): Promise<string[]> {
  const total = items.length;
  const out = new Array<string>(total);

  // Which items actually need translating (rest pass straight through).
  const need: number[] = [];
  for (let i = 0; i < total; i++) {
    const text = items[i];
    const src = from === 'auto' ? detectLang(text) : from;
    if (!text.trim() || src === to) out[i] = text;
    else need.push(i);
  }
  const passthrough = total - need.length;
  if (!need.length) { onProgress?.(total, total); return out; }

  // ---- Optional: server-side Gemini edge function, in chunks. ----
  if (USE_EDGE) {
    const CHUNK = 80;
    let edgeOk = true;
    let done = passthrough;
    for (let c = 0; c < need.length && edgeOk; c += CHUNK) {
      const idxs = need.slice(c, c + CHUNK);
      const tr = await translateViaEdge(idxs.map((i) => items[i]), to);
      if (!tr) { edgeOk = false; break; }
      idxs.forEach((gi, k) => { out[gi] = tr[k] ?? items[gi]; });
      done += idxs.length;
      onProgress?.(done, total);
    }
    if (edgeOk) return out;
  }

  // ---- Default path: MyMemory, one string at a time, with caching. ----
  const cache = new Map<string, string>();
  let done = passthrough;
  for (const i of need) {
    const text = items[i];
    const src = from === 'auto' ? detectLang(text) : from;
    const cached = cache.get(text);
    if (cached !== undefined) {
      out[i] = cached;
    } else {
      const tr = await translateText(text, src, to);
      cache.set(text, tr);
      out[i] = tr;
    }
    done++;
    onProgress?.(done, total);
  }
  return out;
}
