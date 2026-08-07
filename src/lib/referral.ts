import { sb } from './supabase';

const REF_KEY = 'chattree_ref';

function log(ref: string, event: 'visit' | 'activated') {
  void sb.rpc('log_referral', { p_ref: ref, p_event: event }).then(() => {}, () => {});
}

export function captureRef(): void {
  try {
    const fromUrl = new URLSearchParams(location.search).get('ref');
    if (fromUrl && fromUrl.trim()) sessionStorage.setItem(REF_KEY, fromUrl.trim().slice(0, 40));
    const ref = sessionStorage.getItem(REF_KEY);
    if (ref && !sessionStorage.getItem('chattree_ref_v')) {
      sessionStorage.setItem('chattree_ref_v', '1');
      log(ref, 'visit');
    }
  } catch {  }
}

export function markActivated(): void {
  try {
    const ref = sessionStorage.getItem(REF_KEY);
    if (ref && !sessionStorage.getItem('chattree_ref_a')) {
      sessionStorage.setItem('chattree_ref_a', '1');
      log(ref, 'activated');
    }
  } catch {  }
}

export interface RefStat { ref: string; visits: number; activations: number; last_at: string }

export async function referralStats(): Promise<RefStat[]> {
  const { data, error } = await sb.rpc('referral_stats');
  if (error) throw error;
  return ((data || []) as { ref: string; visits: number; activations: number; last_at: string }[])
    .map((r) => ({ ref: r.ref, visits: Number(r.visits), activations: Number(r.activations), last_at: r.last_at }));
}
