import { useState } from 'react';
import { changePassword, deleteAccount, signOut } from '../lib/supabase';
import { useLang } from '../lib/i18n';
import { confirmDialog } from '../lib/dialog';
import { useModal, dialogProps } from '../lib/useModal';

interface Props {
  open: boolean;
  onClose: () => void;
  email: string | null;
  toast: (msg: string, ms?: number) => void;
}

export default function AccountModal({ open, onClose, email, toast }: Props) {
  const { t } = useLang();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  useModal(open, onClose, !busy);
  const [err, setErr] = useState('');

  async function doChangePw() {
    setErr('');
    if (pw.length < 8) { setErr(t('acPwShort')); return; }
    setBusy(true);
    try { await changePassword(pw); setPw(''); toast(t('acPwChanged'), 2200); }
    catch (e) { setErr((e as Error).message || String(e)); }
    finally { setBusy(false); }
  }
  async function doLogout() { await signOut(); onClose(); toast(t('acLoggedOut'), 1600); }
  async function doDelete() {
    if (!(await confirmDialog({ title: t('acDelete'), message: t('acDeleteConfirm1'), confirmLabel: t('dlgDelete'), danger: true }))) return;
    if (!(await confirmDialog({ title: t('acDelete'), message: t('acDeleteConfirm2'), confirmLabel: t('dlgDelete'), danger: true }))) return;
    setErr(''); setBusy(true);
    try { await deleteAccount(); onClose(); toast(t('acDeleted'), 2500); }
    catch (e) { setErr((e as Error).message || String(e)); setBusy(false); }
  }

  return (
    <div className={'hist' + (open ? ' show' : '')} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="hist-box" {...dialogProps} aria-label="Account">
        <span className="x" onClick={onClose}>&times;</span>
        <h3>{t('acTitle')}</h3>
        <p className="hist-sub">{t('acSignedAs')} <b>{email}</b></p>

        <div className="acc-sec">
          <div className="acc-label">{t('acChangePw')}</div>
          <input className="hist-pass" type="password" placeholder={t('acNewPw')}
            value={pw} onChange={(e) => setPw(e.target.value)} />
          <button className="btn hist-open" onClick={doChangePw} disabled={busy}>{t('acUpdatePw')}</button>
        </div>

        <div className="hist-err">{err}</div>

        <div className="acc-actions">
          <button className="mini-btn" onClick={doLogout} disabled={busy}>{t('acLogout')}</button>
          <button className="mini-btn acc-del" onClick={doDelete} disabled={busy}>{t('acDelete')}</button>
        </div>
      </div>
    </div>
  );
}
