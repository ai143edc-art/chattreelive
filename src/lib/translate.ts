import { sb } from './supabase';

export type Lang2 = 'en' | 'hi';
export type FromLang = Lang2 | 'auto';

const MM_EMAIL = (import.meta.env.VITE_MYMEMORY_EMAIL as string | undefined) || 'vikkuedc143@gmail.com';

const USE_EDGE = String(import.meta.env.VITE_USE_EDGE_TRANSLATE || '') === '1';

export function detectLang(s: string): Lang2 {
  return /[ऀ-ॿ]/.test(s) ? 'hi' : 'en';
}

interface MMResp {
  responseData?: { translatedText?: string };
  responseStatus?: number | string;
}

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

export async function translateBatch(
  items: string[],
  from: FromLang,
  to: Lang2,
  onProgress?: (done: number, total: number) => void,
): Promise<string[]> {
  const total = items.length;
  const out = new Array<string>(total);

  const need: number[] = [];
  for (let i = 0; i < total; i++) {
    const text = items[i];
    const src = from === 'auto' ? detectLang(text) : from;
    if (!text.trim() || src === to) out[i] = text;
    else need.push(i);
  }
  const passthrough = total - need.length;
  if (!need.length) { onProgress?.(total, total); return out; }

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
