import { useEffect, useRef } from 'react';

/**
 * The behaviour every dialog is expected to have and none of ours had: Escape
 * closes it, and the page behind it does not scroll while it is open.
 *
 * Pass `enabled: false` for a dialog that must not be dismissed mid-flight —
 * a book export is minutes of work that cannot be resumed, and a sign-in that
 * is already talking to the server should not be abandoned by a stray keypress.
 */
export function useModal(open: boolean, onClose: () => void, enabled = true): void {
  // Callers pass an inline arrow, so keep it in a ref: otherwise the listener
  // is torn down and re-attached on every render of the dialog.
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && enabled) close.current(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, enabled]);
}

/** Spread onto a dialog's box so assistive tech announces it as a dialog. */
export const dialogProps = { role: 'dialog', 'aria-modal': true } as const;
