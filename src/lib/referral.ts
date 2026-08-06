// Promoter referral tracking. Hand out links like chattreeapp.fun/?ref=rahul;
// each visitor's ref is logged (a "visit", and an "activated" if they actually
// use the tool). The owner sees per-promoter counts at ?refstats. All best-effort
// and fail-silent — tracking must never break the app.
import { sb } from './supabase';

const REF_KEY = 'chattree_ref';

function log(ref: string, event: 'visit' | 'activated') {
  void sb.rpc('log_referral', { p_ref: ref, p_event: event }).then(() => {}, () => {});
}

/** Read ?ref= once, remember it for this browser session, and log a single visit. */
export function captureRef(): void {
  try {
    const fromUrl = new URLSearchParams(location.search).get('ref');
    if (fromUrl && fromUrl.trim()) sessionStorage.setItem(REF_KEY, fromUrl.trim().slice(0, 40));
    const ref = sessionStorage.getItem(REF_KEY);
    if (ref && !sessionStorage.getItem('chattree_ref_v')) {
      sessionStorage.setItem('chattree_ref_v', '1');
      log(ref, 'visit');
    }
  } catch { /* ignore */ }
}

/** Fire once per session when the visitor actually starts using the tool. */
export function markActivated(): void {
  try {
    const ref = sessionStorage.getItem(REF_KEY);
    if (ref && !sessionStorage.getItem('chattree_ref_a')) {
      sessionStorage.setItem('chattree_ref_a', '1');
      log(ref, 'activated');
    }
  } catch { /* ignore */ }
}

export interface RefStat { ref: string; visits: number; activations: number; last_at: string }

/** Owner-only aggregated stats (the RPC returns nothing unless you're the owner). */
export async function referralStats(): Promise<RefStat[]> {
  const { data, error } = await sb.rpc('referral_stats');
  if (error) throw error;
  return ((data || []) as { ref: string; visits: number; activations: number; last_at: string }[])
    .map((r) => ({ ref: r.ref, visits: Number(r.visits), activations: Number(r.activations), last_at: r.last_at }));
}
