import { useState } from 'react';
import { changePassword } from '../lib/supabase';
import { useLang } from '../lib/i18n';

interface Props {
  open: boolean;
  onDone: () => void;
  toast: (msg: string, ms?: number) => void;
}

const MIN_PW = 8;

/** Shown after the user follows a password-reset link (a PASSWORD_RECOVERY
 *  session is already active), so they can pick a new password. */
// Deliberately not Escape-dismissable: the user arrived from a recovery link
// and closing this leaves them signed in with a password they cannot use.
export default function ResetPasswordModal({ open, onDone, toast }: Props) {
  const { t, lang } = useLang();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    setErr('');
    if (pw.length < MIN_PW) {
      setErr(lang === 'hi' ? `पासवर्ड कम से कम ${MIN_PW} अक्षर का होना चाहिए।` : `Password must be at least ${MIN_PW} characters.`);
      return;
    }
    setBusy(true);
    try {
      await changePassword(pw);
      setPw('');
      toast(t('pwUpdated'), 2600);
      onDone();
    } catch (e) {
      setErr((e as Error).message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={'auth-overlay' + (open ? ' show' : '')}>
      <div className="auth-card">
        <div className="auth-logo">🔑</div>
        <h2>{t('setNewTitle')}</h2>
        <p className="auth-sub">{t('setNewSub')}</p>

        <div className="auth-field">
          <span className="ic">🔒</span>
          <input type="password" autoFocus autoComplete="new-password"
            placeholder={lang === 'hi' ? `नया पासवर्ड (कम से कम ${MIN_PW} अक्षर)` : `New password (min ${MIN_PW} characters)`}
            value={pw} onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
        </div>

        <button className="auth-submit" onClick={submit} disabled={busy}>
          {busy
            ? <span className="btn-load"><span className="spinner btn" />{t('pleaseWait')}</span>
            : t('updatePw')}
        </button>

        <div className="auth-err">{err}</div>
      </div>
    </div>
  );
}
