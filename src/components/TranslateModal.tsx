import { useState } from 'react';
import { translateText } from '../lib/translate';
import type { FromLang, Lang2 } from '../lib/translate';
import { useLang } from '../lib/i18n';
import { useModal, dialogProps } from '../lib/useModal';

interface Props {
  open: boolean;
  onClose: () => void;
  onTranslateChat: (from: FromLang, to: Lang2) => void;
  translating: boolean;
  translated: boolean;
}

export default function TranslateModal({ open, onClose, onTranslateChat, translating, translated }: Props) {
  useModal(open, onClose, !translating);
  const { t } = useLang();
  const [from, setFrom] = useState<FromLang>('auto');
  const [to, setTo] = useState<Lang2>('en');

  const [qText, setQText] = useState('');
  const [qFrom, setQFrom] = useState<FromLang>('auto');
  const [qTo, setQTo] = useState<Lang2>('hi');
  const [qOut, setQOut] = useState('');
  const [qBusy, setQBusy] = useState(false);
  const [qErr, setQErr] = useState('');

  async function quick() {
    setQErr(''); setQOut('');
    const text = qText.trim();
    if (!text) return;
    setQBusy(true);
    try { setQOut(await translateText(text, qFrom, qTo)); }
    catch (e) { setQErr((e as Error).message || String(e)); }
    finally { setQBusy(false); }
  }

  return (
    <div className={'hist' + (open ? ' show' : '')} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="hist-box tr-box" {...dialogProps} aria-label="Translate chat">
        <span className="x" onClick={onClose}>&times;</span>
        <h3>{t('trTitle')}</h3>

        <div className="tr-sec">
          <div className="tr-h">{t('trWhole')}</div>
          <div className="tr-langs">
            <label>{t('trFrom')}
              <select value={from} onChange={(e) => setFrom(e.target.value as FromLang)}>
                <option value="auto">{t('trAuto')}</option>
                <option value="en">{t('trEnglish')}</option>
                <option value="hi">{t('trHindi')}</option>
              </select>
            </label>
            <span className="tr-arrow">→</span>
            <label>{t('trTo')}
              <select value={to} onChange={(e) => setTo(e.target.value as Lang2)}>
                <option value="en">{t('trEnglish')}</option>
                <option value="hi">{t('trHindi')}</option>
              </select>
            </label>
          </div>
          <button className="tr-go" disabled={translating} onClick={() => onTranslateChat(from, to)}>
            {translating ? t('trGoing') : translated ? t('trReGo') : t('trGo')}
          </button>
          <p className="tr-note">{t('trNote')}</p>
        </div>

        <div className="tr-div" />

        <div className="tr-sec">
          <div className="tr-h">{t('trQuick')}</div>
          <textarea className="tr-ta" rows={3} placeholder={t('trQuickPh')}
            value={qText} onChange={(e) => setQText(e.target.value)} />
          <div className="tr-langs">
            <label>{t('trFrom')}
              <select value={qFrom} onChange={(e) => setQFrom(e.target.value as FromLang)}>
                <option value="auto">{t('trAutoShort')}</option>
                <option value="en">{t('trEnglish')}</option>
                <option value="hi">{t('trHindi')}</option>
              </select>
            </label>
            <span className="tr-arrow">→</span>
            <label>{t('trTo')}
              <select value={qTo} onChange={(e) => setQTo(e.target.value as Lang2)}>
                <option value="hi">{t('trHindi')}</option>
                <option value="en">{t('trEnglish')}</option>
              </select>
            </label>
            <button className="tr-go sm" disabled={qBusy} onClick={quick}>{qBusy ? '…' : t('trGoSm')}</button>
          </div>
          {qErr && <div className="tr-err">{qErr}</div>}
          {qOut && (
            <div className="tr-out">
              <span>{qOut}</span>
              <button className="tr-copy" title={t('trCopy')} onClick={() => navigator.clipboard?.writeText(qOut)}>{t('trCopy')}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
