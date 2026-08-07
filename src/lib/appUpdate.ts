const KEY = 'chattree_reload_ts';

function reloadOnce(): void {
  let last = 0;
  try { last = Number(sessionStorage.getItem(KEY) || 0); } catch {  }
  if (Date.now() - last < 10_000) return;
  try { sessionStorage.setItem(KEY, String(Date.now())); } catch {  }
  location.reload();
}

export function watchForNewBuild(): void {

  window.addEventListener('vite:preloadError', (e) => {
    e.preventDefault();
    reloadOnce();
  });

  if ('serviceWorker' in navigator) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController) reloadOnce();
    });
  }
}
