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

  window.plausible = window.plausible || function (...args: unknown[]) { (window.plausible!.q = window.plausible!.q || []).push(args); };
}

export function trackEvent(name: string, props?: Record<string, string | number | boolean>): void {
  try { window.plausible?.(name, props ? { props } : undefined); } catch {  }
}
