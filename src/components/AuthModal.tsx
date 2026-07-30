import { useState } from 'react';
import { signIn, signUp, signInWithGoogle, resetPassword } from '../lib/supabase';
import Turnstile, { captchaEnabled } from './Turnstile';
import { useModal, dialogProps } from '../lib/useModal';
import { useLang } from '../lib/i18n';
import LangToggle from './LangToggle';

interface Props {
  open: boolean;
  onClose: () => void;
  toast: (msg: string, ms?: number) => void;
}

const MIN_PW = 8;

export default function AuthModal({ open, onClose, toast }: Props) {
  const { t, lang } = useLang();
  const [mode, setMode] = useState<'in' | 'up' | 'reset'>('in');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [captcha, setCaptcha] = useState('');

  function close() { setEmail(''); setPw(''); setErr(''); setOk(false); setBusy(false); setCaptcha(''); setMode('in'); onClose(); }
  // Escape must not abandon a sign-in that is already in flight.
  useModal(open, close, !busy);
  function go(next: 'in' | 'up' | 'reset') { setMode(next); setErr(''); setOk(false); }
  const keyActivate = (fn: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); }
  };

  async function google() {
    setErr(''); setBusy(true);
    try { const { error } = await signInWithGoogle(); if (error) throw error; }
    catch (e) { setErr((e as Error).message || String(e)); setBusy(false); }
    // on success the browser redirects to Google, so no further handling needed
  }

  async function sendReset() {
    setErr(''); setOk(false);
    if (!email) { setErr(t('errBoth')); return; }
    if (captchaEnabled && !captcha) { setErr(t('errCaptcha')); return; }
    setBusy(true);
    try {
      await resetPassword(email, captcha || undefined);
      setOk(true); setErr(t('resetSent'));
    } catch (e) {
      setErr((e as Error).message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (mode === 'reset') { sendReset(); return; }
    setErr(''); setOk(false);
    if (!email || !pw) { setErr(t('errBoth')); return; }
    if (pw.length < MIN_PW) {
      setErr(lang === 'hi' ? `पासवर्ड कम से कम ${MIN_PW} अक्षर का होना चाहिए।` : `Password must be at least ${MIN_PW} characters.`);
      return;
    }
    if (captchaEnabled && !captcha) { setErr(t('errCaptcha')); return; }
    setBusy(true);
    try {
      if (mode === 'in') {
        const { error } = await signIn(email, pw, captcha || undefined);
        if (error) throw error;
        toast(t('okLoggedIn'), 1800); close();
      } else {
        const { data, error } = await signUp(email, pw, captcha || undefined);
        if (error) throw error;
        if (data.session) { toast(t('okCreated'), 1800); close(); }
        else { setOk(true); setErr(t('okCreatedConfirm')); setMode('in'); }
      }
    } catch (e) {
      setErr((e as Error).message || String(e));
    } finally {
      setBusy(false);
    }
  }

  const signup = mode === 'up';
  const reset = mode === 'reset';
  return (
    <div className={'auth-overlay' + (open ? ' show' : '')} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="auth-card" {...dialogProps} aria-label="Account">
        <span className="auth-x" onClick={close}>&times;</span>
        <div className="auth-top"><LangToggle /></div>
        <div className="auth-logo">💬</div>
        <h2>{reset ? t('resetTitle') : signup ? t('createAccount') : t('welcomeBack')}</h2>
        <p className="auth-sub">{reset ? t('resetSub') : signup ? t('signUpSub') : t('signInSub')}</p>

        <div className="auth-field">
          <span className="ic">📧</span>
          <input type="email" placeholder={t('emailPh')} autoComplete="email"
            value={email} onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && reset) submit(); }} />
        </div>
        {!reset && (
          <div className="auth-field">
            <span className="ic">🔒</span>
            <input type="password"
              placeholder={lang === 'hi' ? `पासवर्ड (कम से कम ${MIN_PW} अक्षर)` : `Password (min ${MIN_PW} characters)`}
              autoComplete={signup ? 'new-password' : 'current-password'}
              value={pw} onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
          </div>
        )}

        {mode === 'in' && (
          <div className="auth-forgot">
            <a role="button" tabIndex={0} onClick={() => go('reset')} onKeyDown={keyActivate(() => go('reset'))}>{t('forgotLink')}</a>
          </div>
        )}

        {captchaEnabled && (
          <div className="auth-captcha"><Turnstile onToken={setCaptcha} /></div>
        )}

        <button className="auth-submit" onClick={submit} disabled={busy}>
          {busy
            ? <span className="btn-load"><span className="spinner btn" />{t('pleaseWait')}</span>
            : reset ? t('sendReset') : signup ? t('signUp') : t('logIn')}
        </button>

        {reset ? (
          <div className="auth-toggle">
            <a role="button" tabIndex={0} onClick={() => go('in')} onKeyDown={keyActivate(() => go('in'))}>{t('backToLogin')}</a>
          </div>
        ) : import.meta.env.VITE_GOOGLE_AUTH === '1' ? (
          <>
            <div className="auth-or"><span>{t('orText')}</span></div>
            <button className="auth-google" onClick={google} disabled={busy} type="button">
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.4 5.4 2.5 13.3l7.9 6.1C12.3 13.2 17.7 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.1 5.3-4.6 7l7.1 5.5c4.2-3.9 6.6-9.6 6.6-16.5z"/>
                <path fill="#FBBC05" d="M10.4 28.6c-.5-1.4-.8-2.9-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C.9 16.3 0 20 0 24s.9 7.7 2.5 10.7l7.9-6.1z"/>
                <path fill="#34A853" d="M24 48c6.4 0 11.9-2.1 15.8-5.8l-7.1-5.5c-2 1.3-4.5 2.1-8.7 2.1-6.3 0-11.7-3.7-13.6-9.1l-7.9 6.1C6.4 42.6 14.6 48 24 48z"/>
              </svg>
              {t('continueGoogle')}
            </button>
          </>
        ) : null}

        <div className={'auth-err' + (ok ? ' ok' : '')}>{err}</div>

        {!reset && (
          <div className="auth-toggle">
            {signup
              ? <>{t('haveAccount')} <a role="button" tabIndex={0} onClick={() => go('in')} onKeyDown={keyActivate(() => go('in'))}>{t('logInLink')}</a></>
              : <>{t('newHere')} <a role="button" tabIndex={0} onClick={() => go('up')} onKeyDown={keyActivate(() => go('up'))}>{t('createLink')}</a></>}
          </div>
        )}

        <div className="auth-note">{t('privateNote')}</div>
      </div>
    </div>
  );
}
