/**
 * Survive a deploy while the app is open.
 *
 * Each build gives its chunks new hashed filenames, so a tab still running the
 * previous build will ask for files that no longer exist. (Worse, the SPA
 * rewrite answers those requests with index.html, so the browser tries to parse
 * HTML as a module and reports "Failed to fetch dynamically imported module".)
 *
 * Both hooks below pull the tab onto the fresh build instead.
 */

const KEY = 'chattree_reload_ts';

/** Reload, but never more than once per 10s so a broken deploy can't loop. */
function reloadOnce(): void {
  let last = 0;
  try { last = Number(sessionStorage.getItem(KEY) || 0); } catch { /* private mode */ }
  if (Date.now() - last < 10_000) return;
  try { sessionStorage.setItem(KEY, String(Date.now())); } catch { /* ignore */ }
  location.reload();
}

export function watchForNewBuild(): void {
  // Vite fires this when a lazily-imported chunk (html2canvas, jspdf, qrcode…)
  // can't be fetched — almost always because it was replaced by a new deploy.
  window.addEventListener('vite:preloadError', (e) => {
    e.preventDefault();          // don't surface the raw module error to the user
    reloadOnce();
  });

  // A newly deployed service worker taking over this tab means new assets exist.
  // Ignore the very first install (there was no controller to replace).
  if ('serviceWorker' in navigator) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController) reloadOnce();
    });
  }
}
