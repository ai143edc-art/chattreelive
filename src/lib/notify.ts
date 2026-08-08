export function notifySupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function askNotify(): void {
  try {
    if (notifySupported() && Notification.permission === 'default') void Notification.requestPermission();
  } catch {}
}

export function notify(title: string, body: string): void {
  try {
    if (!notifySupported() || Notification.permission !== 'granted') return;
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') return;
    const n = new Notification(title || 'Chat Tree', { body, icon: '/pwa-192.png', tag: 'chattree-live' });
    n.onclick = () => { try { window.focus(); n.close(); } catch {} };
  } catch {}
}
