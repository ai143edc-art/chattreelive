import { useEffect, useRef } from 'react';

/**
 * Cloudflare Turnstile CAPTCHA — only renders when VITE_TURNSTILE_SITE_KEY is set.
 * When unconfigured it renders nothing and never blocks auth, so the app works
 * out of the box; enable it by adding the env var + turning on captcha in Supabase.
 */
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

interface TurnstileAPI {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
}
declare global {
  interface Window { turnstile?: TurnstileAPI }
}

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT_SRC; s.async = true; s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load CAPTCHA'));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export const captchaEnabled = !!SITE_KEY;

/** Renders the widget and reports the solved token (or '' when reset/expired). */
export default function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const idRef = useRef<string | null>(null);

  useEffect(() => {
    if (!SITE_KEY) return;
    let cancelled = false;
    loadScript().then(() => {
      if (cancelled || !boxRef.current || !window.turnstile) return;
      idRef.current = window.turnstile.render(boxRef.current, {
        sitekey: SITE_KEY,
        callback: (token: string) => onToken(token),
        'expired-callback': () => onToken(''),
        'error-callback': () => onToken(''),
      });
    }).catch(() => { /* network issue — leave auth usable */ });
    return () => {
      cancelled = true;
      if (idRef.current && window.turnstile) {
        try { window.turnstile.remove(idRef.current); } catch { /* ignore */ }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!SITE_KEY) return null;
  return <div ref={boxRef} className="cf-turnstile" style={{ marginTop: 6 }} />;
}
