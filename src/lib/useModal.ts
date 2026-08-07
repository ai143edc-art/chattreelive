import { useEffect, useRef } from 'react';

export function useModal(open: boolean, onClose: () => void, enabled = true): void {

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

export const dialogProps = { role: 'dialog', 'aria-modal': true } as const;
