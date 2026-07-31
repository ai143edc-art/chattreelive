import type { ChangeEvent } from 'react';
import { MODELS, WALLPAPERS } from '../lib/models';
import type { PhoneModel } from '../lib/models';
import { fileToAvatar, fileToDataUrl } from '../lib/image';
import MiniSelect from './MiniSelect';
import { useLang } from '../lib/i18n';
import { alertDialog } from '../lib/dialog';
import LangToggle from './LangToggle';

interface Props {
  meName: string | null;
  onRenameMe: (v: string) => void;
  onSwap: () => void;
  model: PhoneModel;
  onModel: (m: PhoneModel) => void;
  contactTitle: string;
  onTitle: (v: string) => void;
  status: string;
  onStatus: (v: string) => void;
  showStatusBar: boolean;
  onToggleStatusBar: () => void;
  showTyping: boolean;
  onToggleTyping: () => void;
  settingsOpen: boolean;
  onToggleSettings: () => void;
  editMode: boolean;
  onEditMode: () => void;
  editPending?: boolean;
  onHome: () => void;
  userEmail: string | null;
  onLogin: () => void;
  onAccount: () => void;
  wallpaper: string;
  onWallpaper: (css: string) => void;
  avatar: string | null;
  onAvatar: (dataUrl: string | null) => void;
}

export default function Toolbar(p: Props) {
  const { t } = useLang();
  async function pickAvatar(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try { p.onAvatar(await fileToAvatar(f)); }
    catch (err) { alertDialog({ message: (err as Error).message }); }
  }
  async function pickWallpaper(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try { p.onWallpaper(`center/cover no-repeat url("${await fileToDataUrl(f)}")`); }
    catch (err) { alertDialog({ message: (err as Error).message }); }
  }
  return (
    <div className="toolbar">
      <div className="toolbar-top">
        <span className="tb-brand" onClick={p.onHome} title={t('tbHome')}>💬 Chat Tree</span>
        <span className="spacer" />
        <LangToggle />
        {p.userEmail
          ? <button className="collapse-btn" onClick={p.onAccount} title={p.userEmail}>👤 {p.userEmail.split('@')[0]}</button>
          : <button className="collapse-btn" onClick={p.onLogin}>{t('tbLogin')}</button>}
        <button className={'collapse-btn' + (p.settingsOpen ? ' on' : '')} onClick={p.onToggleSettings}>{t('tbSettings')}</button>
        <button className={'collapse-btn' + (p.editMode ? ' on' : '') + (p.editPending ? ' busy' : '')}
          onClick={p.onEditMode} disabled={p.editPending} title={t('tbEditHint')}>
          {p.editPending ? <span className="spinner btn" /> : null}
          {t('tbEdit')} {p.editMode ? t('on') : t('off')}
        </button>
      </div>

      {p.settingsOpen && (
        <div className="panel">
          <div className="settings-row">
            <div className="ctrl">
              <label>{t('tbYou')}</label>
              <input value={p.meName ?? ''} placeholder={t('tbYourName')} onChange={(e) => p.onRenameMe(e.target.value)} />
            </div>
            <button className="swap-btn" title={t('tbSwap')} onClick={p.onSwap}>⇄</button>
            <div className="ctrl">
              <label>{t('tbContact')}</label>
              <input value={p.contactTitle} placeholder={t('tbNamePh')} onChange={(e) => p.onTitle(e.target.value)} />
            </div>
            <div className="ctrl" style={{ flex: '0 0 auto' }}>
              <label>{t('tbStatusBar')}</label>
              <button className="mini-btn" onClick={p.onToggleStatusBar}>📶 {p.showStatusBar ? t('on') : t('off')}</button>
            </div>
            <div className="ctrl" style={{ flex: '0 0 auto' }}>
              <label>{t('tbTyping')}</label>
              <button className="mini-btn" onClick={p.onToggleTyping}>⌨️ {p.showTyping ? t('on') : t('off')}</button>
            </div>
            <div className="ctrl" style={{ flex: '0 0 auto' }}>
              <label>{t('tbAvatar')}</label>
              <div className="avatar-ctrl">
                <label className="mini-btn">{p.avatar ? t('tbChange') : t('tbSet')}
                  <input type="file" accept="image/*" hidden onChange={pickAvatar} />
                </label>
                {p.avatar && <button className="mini-btn" title={t('tbRemove')} onClick={() => p.onAvatar(null)}>✕</button>}
              </div>
            </div>
          </div>
          <div className="settings-row">
            <div className="ctrl">
              <label>{t('tbStatus')}</label>
              <div className="status-ctrl">
                <MiniSelect
                  value={p.status}
                  onChange={p.onStatus}
                  placeholder={t('stCustom')}
                  options={[
                    { label: t('stOnline'), value: 'online' },
                    { label: t('stTyping'), value: 'typing…' },
                    { label: t('stSeen'), value: 'last seen recently' },
                    { label: t('stHidden'), value: '' },
                  ]}
                />
                <input value={p.status} placeholder={t('tbCustomStatus')} onChange={(e) => p.onStatus(e.target.value)} />
              </div>
            </div>
            <div className="ctrl">
              <label>{t('tbWallpaper')}</label>
              <div className="wp-ctrl">
                <MiniSelect
                  value={p.wallpaper}
                  onChange={p.onWallpaper}
                  placeholder={t('tbCustomImage')}
                  options={WALLPAPERS.map((w) => ({ label: w.name, value: w.css }))}
                />
                <label className="mini-btn" title={t('tbUploadWp')}>📷
                  <input type="file" accept="image/*" hidden onChange={pickWallpaper} />
                </label>
              </div>
            </div>
            <div className="ctrl">
              <label>{t('tbModel')}</label>
              <MiniSelect
                value={p.model.name}
                onChange={(name) => { const m = MODELS.find((x) => x.name === name); if (m) p.onModel(m); }}
                options={MODELS.map((m) => ({ label: `${m.name} (${m.w}×${m.h})`, value: m.name }))}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
