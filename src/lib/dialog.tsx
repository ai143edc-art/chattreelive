import { useEffect, useRef, useState } from 'react';
import { useLang } from './i18n';

// App-styled replacements for the browser's confirm() / alert() / prompt(), so
// every dialog matches the app instead of the plain OS box. Imperative + promise-
// based, driven by a single <DialogHost/> mounted once at the root — so any code
// can just `await confirmDialog({...})` without threading props/hooks around.

type Kind = 'confirm' | 'alert' | 'prompt';
interface Req {
  kind: Kind;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  placeholder?: string;
  defaultValue?: string;
  resolve: (v: boolean | string | null | undefined) => void;
}

let emit: ((r: Req) => void) | null = null;

function ask(req: Omit<Req, 'resolve'>): Promise<boolean | string | null | undefined> {
  return new Promise((resolve) => {
    if (!emit) {
      // host not mounted yet → fall back to native so nothing silently breaks
      if (req.kind === 'confirm') resolve(window.confirm(req.message));
      else if (req.kind === 'prompt') resolve(window.prompt(req.message, req.defaultValue ?? ''));
      else { window.alert(req.message); resolve(undefined); }
      return;
    }
    emit({ ...req, resolve });
  });
}

export function confirmDialog(o: { title?: string; message: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean }): Promise<boolean> {
  return ask({ kind: 'confirm', ...o }) as Promise<boolean>;
}
export function alertDialog(o: { title?: string; message: string; confirmLabel?: string }): Promise<void> {
  return ask({ kind: 'alert', ...o }) as Promise<void>;
}
export function promptDialog(o: { title?: string; message: string; defaultValue?: string; placeholder?: string; confirmLabel?: string; cancelLabel?: string }): Promise<string | null> {
  return ask({ kind: 'prompt', ...o }) as Promise<string | null>;
}

export function DialogHost() {
  const { t } = useLang();
  const [req, setReq] = useState<Req | null>(null);
  const [val, setVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emit = (r) => { setVal(r.defaultValue ?? ''); setReq(r); };
    return () => { emit = null; };
  }, []);

  useEffect(() => {
    if (req?.kind === 'prompt') setTimeout(() => inputRef.current?.focus(), 20);
  }, [req]);

  if (!req) return null;

  const finish = (v: boolean | string | null | undefined) => { req.resolve(v); setReq(null); };
  const accept = () => finish(req.kind === 'confirm' ? true : req.kind === 'prompt' ? val : undefined);
  const dismiss = () => finish(req.kind === 'prompt' ? null : req.kind === 'confirm' ? false : undefined);
  const cancelable = req.kind !== 'alert';

  return (
    <div className="hist show dlg-overlay" onClick={(e) => { if (e.target === e.currentTarget) dismiss(); }}
      onKeyDown={(e) => { if (e.key === 'Escape') dismiss(); }}>
      <div className="hist-box dlg-box" role="alertdialog" aria-modal="true" aria-label={req.title || req.message}>
        {req.title && <h3>{req.title}</h3>}
        <p className="dlg-msg">{req.message}</p>
        {req.kind === 'prompt' && (
          <input ref={inputRef} className="dlg-input" value={val} placeholder={req.placeholder}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') accept(); }} />
        )}
        <div className="dlg-actions">
          {cancelable && <button className="dlg-btn dlg-cancel" onClick={dismiss}>{req.cancelLabel || t('dlgCancel')}</button>}
          <button className={'dlg-btn dlg-ok' + (req.danger ? ' danger' : '')} onClick={accept} autoFocus={req.kind !== 'prompt'}>
            {req.confirmLabel || (req.kind === 'prompt' ? t('dlgSave') : t('dlgOk'))}
          </button>
        </div>
      </div>
    </div>
  );
}
