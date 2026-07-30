import { useRef, useState } from 'react';
import { useLang } from '../lib/i18n';
import LangToggle from './LangToggle';

export interface LoadedChat {
  rawText: string;
  mediaMap: Record<string, string>;
  mediaBlobs: Record<string, Blob>;
}

interface Props {
  onLoaded: (l: LoadedChat) => void;
  onHistory: () => void;
  onBlank: () => void;
  onHome: () => void;
  userEmail: string | null;
  onLogin: () => void;
  onAccount: () => void;
}

export default function Uploader({ onLoaded, onHistory, onBlank, onHome, userEmail, onLogin, onAccount }: Props) {
  const { t } = useLang();
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState('');

  async function handleFiles(files: File[]) {
    if (!files.length) return;
    setBusy(t('busyReading'));
    try {
      let chatText: string | null = null;
      const mediaMap: Record<string, string> = {};
      const mediaBlobs: Record<string, Blob> = {};
      const register = (name: string, blob: Blob) => {
        const b = name.split('/').pop()!.toLowerCase();
        mediaMap[b] = URL.createObjectURL(blob);
        mediaBlobs[b] = blob;
      };
      for (const f of files) {
        const lower = f.name.toLowerCase();
        if (lower.endsWith('.zip')) {
          try {
            setBusy(t('busyZip'));
            // ~95 KB — only a .zip upload needs it, so it stays out of the
            // bundle every visitor downloads and loads on first use instead.
            const { default: JSZip } = await import('jszip');
            const zip = await JSZip.loadAsync(f);
            const entries = Object.values(zip.files);
            const txtEntry = entries.find((e) => /(^|\/)_chat\.txt$/i.test(e.name))
              || entries.find((e) => e.name.toLowerCase().endsWith('.txt'));
            if (txtEntry) chatText = await txtEntry.async('string');
            const media = entries.filter((e) => !e.dir && e !== txtEntry && !e.name.toLowerCase().endsWith('.txt'));
            let done = 0;
            for (const e of media) {
              register(e.name, await e.async('blob'));
              done++;
              if (media.length > 3) setBusy(`${t('busyExtract')} ${done} / ${media.length}…`);
            }
          } catch (err) {
            alert(t('errZip'));
            console.error(err);
          }
        } else if (lower.endsWith('.txt')) {
          chatText = await f.text();
        } else {
          register(f.name, f);
        }
      }
      if (!chatText) {
        alert(t('errNoTxt'));
        return;
      }
      setBusy(t('busyBuilding'));
      onLoaded({ rawText: chatText, mediaMap, mediaBlobs });
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="up-screen">
      <header className="up-nav">
        <span className="lp-logo" style={{ cursor: 'pointer' }} onClick={onHome}>💬 Chat Tree</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LangToggle />
          {userEmail
            ? <button className="lp-cta sm" onClick={onAccount}>👤 {userEmail.split('@')[0]}</button>
            : <button className="lp-cta sm" onClick={onLogin}>{t('logIn')}</button>}
        </span>
      </header>

      <div className="up-wrap">
        <h1 className="up-title">{t('upTitle')}</h1>
        <p className="up-sub">{t('upSub')}</p>

        <div className="up-cards">
          <button className="up-card blank" onClick={onBlank}>
            <span className="up-ic">✍️</span>
            <span className="up-ct">{t('upBlank')}</span>
            <span className="up-cd">{t('upBlankDesc')}</span>
          </button>

          <div
            className={'up-card drop' + (drag ? ' drag' : '')}
            style={{ position: 'relative' }}
            onClick={() => { if (!busy) inputRef.current?.click(); }}
            onDragEnter={(e) => { e.preventDefault(); if (!busy) setDrag(true); }}
            onDragOver={(e) => { e.preventDefault(); if (!busy) setDrag(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDrag(false); }}
            onDrop={(e) => { e.preventDefault(); setDrag(false); if (!busy && e.dataTransfer.files?.length) handleFiles([...e.dataTransfer.files]); }}
          >
            <span className="up-ic">📤</span>
            <span className="up-ct">{t('upUpload')}</span>
            <span className="up-cd">{t('upUploadDesc')} <b>.zip</b> / <b>_chat.txt</b> {t('upWithMedia')}</span>
            <input
              ref={inputRef} type="file" multiple hidden
              accept=".zip,.txt,image/*,video/*,audio/*,.opus,.vcf,.pdf,.doc,.docx"
              onChange={(e) => handleFiles([...(e.target.files || [])])}
            />
            {busy && (
              <div className="up-busy">
                <span className="spinner lg" />
                <span className="lb-text">{busy}</span>
              </div>
            )}
          </div>
        </div>

        <div className="up-foot">
          <button className="lp-cta ghost" onClick={onHistory}>{t('upOpenHistory')}</button>
          <div className="up-note">
            {userEmail
              ? <>{t('upLoggedInAs')} <b>{userEmail}</b> · <a role="button" tabIndex={0} onClick={onAccount} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAccount(); } }}>{t('upAccount')}</a></>
              : <><a role="button" tabIndex={0} onClick={onLogin} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onLogin(); } }}>{t('logIn')}</a> {t('upLoginSave')}</>}
          </div>
        </div>

        <details className="up-help">
          <summary>{t('upHelp')}</summary>
          <p>{t('upHelpBody')}</p>
        </details>
      </div>
    </div>
  );
}
