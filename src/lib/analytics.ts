/**
 * Optional, privacy-friendly analytics + error reporting.
 *
 * Disabled by default — the app ships with NO tracking. To turn it on, set one
 * env var and redeploy:
 *
 *   VITE_PLAUSIBLE_DOMAIN=chat-tree-delta.vercel.app
 *
 * This loads Plausible (cookieless, GDPR-friendly, no cross-site tracking). If
 * the var is empty, nothing is loaded and every call below is a no-op.
 *
 * Plausible is self-hostable; to point at your own instance also set
 *   VITE_PLAUSIBLE_SRC=https://your-instance/js/script.js
 * Remember to allow the host in your CSP (netlify.toml / vercel.json) if you
 * change it away from plausible.io.
 */

const DOMAIN = import.meta.env.VITE_PLAUSIBLE_DOMAIN as string | undefined;
const SRC = (import.meta.env.VITE_PLAUSIBLE_SRC as string | undefined)
  || 'https://plausible.io/js/script.js';

interface PlausibleFn { (event: string, opts?: { props?: Record<string, string | number | boolean> }): void; q?: unknown[] }
declare global { interface Window { plausible?: PlausibleFn } }

export function initAnalytics(): void {
  if (!DOMAIN || typeof document === 'undefined') return;
  if (document.querySelector('script[data-chat-tree-analytics]')) return;
  const s = document.createElement('script');
  s.defer = true;
  s.setAttribute('data-domain', DOMAIN);
  s.setAttribute('data-chat-tree-analytics', '');
  s.src = SRC;
  document.head.appendChild(s);
  // queue stub so trackEvent() calls before the script loads are not lost
  window.plausible = window.plausible || function (...args: unknown[]) { (window.plausible!.q = window.plausible!.q || []).push(args); };
}

/** Fire a custom event (no-op unless analytics are enabled). */
export function trackEvent(name: string, props?: Record<string, string | number | boolean>): void {
  try { window.plausible?.(name, props ? { props } : undefined); } catch { /* never break the app for analytics */ }
}
