import { useState } from 'react';
import { CATEGORY_PRESETS, catEmoji } from '../lib/categories';
import { useLang } from '../lib/i18n';
import { useModal, dialogProps } from '../lib/useModal';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (category: string | null) => void;
  saving: boolean;
}

export default function SaveModal({ open, onClose, onSave, saving }: Props) {
  const { t } = useLang();
  const [sel, setSel] = useState('');
  const [custom, setCustom] = useState('');
  const chosen = custom.trim() || sel;

  function reset() { setSel(''); setCustom(''); }
  function close() { if (!saving) { reset(); onClose(); } }
  useModal(open, close, !saving);
  function save() { onSave(chosen || null); reset(); }

  return (
    <div className={'hist' + (open ? ' show' : '')} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="hist-box sv-box" {...dialogProps} aria-label="Save chat">
        <span className="x" onClick={close}>&times;</span>
        <h3>{t('svTitle')}</h3>
        <p className="sv-sub">{t('svSub')}</p>

        <div className="sv-chips">
          {CATEGORY_PRESETS.map((c) => (
            <button key={c} className={'sv-chip' + (sel === c && !custom.trim() ? ' on' : '')}
              onClick={() => { setSel((v) => (v === c ? '' : c)); setCustom(''); }}>
              {catEmoji(c)} {c}
            </button>
          ))}
        </div>

        <input className="sv-custom" placeholder={t('svCustom')}
          value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={30} />

        <div className="sv-actions">
          <button className="sv-skip" disabled={saving} onClick={() => onSave(null)}>{t('svSkip')}</button>
          <button className="sv-save" disabled={saving} onClick={save}>
            {saving ? <span className="btn-load"><span className="spinner btn" />{t('svSaving')}</span>
              : chosen ? `${t('svSaveTo')} ${chosen}` : t('svSave')}
          </button>
        </div>
      </div>
    </div>
  );
}
