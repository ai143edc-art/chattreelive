import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useLang } from '../lib/i18n';
import {
  BOOK_THEMES, BOOK_BORDERS, BOOK_SIZES, defaultBookConfig, themeOf, sizeOf,
  weaveUrl, vignetteBg, swatchCss, rgba,
  loadTemplates, saveTemplate, deleteTemplate,
} from '../lib/bookThemes';
import type { BookConfig, BookTemplate } from '../lib/bookThemes';
import { useModal, dialogProps } from '../lib/useModal';

interface Props {
  open: boolean;
  onClose: () => void;
  onExport: (config: BookConfig) => void;
  exporting: boolean;
  progress: { done: number; total: number } | null;
  defaultTitle: string;
  avatar: string | null;
  meName: string | null;
  senders: string[];
  msgCount: number;
  days: number;
  mediaCount: number;
  dateRange?: string;
}

export default function BookModal(p: Props) {
  useModal(p.open, p.onClose, !p.exporting);
  const { t } = useLang();
  const [cfg, setCfg] = useState<BookConfig>(() => defaultBookConfig(p.defaultTitle));
  const [tpls, setTpls] = useState<BookTemplate[]>([]);
  const [tplName, setTplName] = useState('');

  useEffect(() => {
    if (p.open) { setCfg((c) => ({ ...c, title: p.defaultTitle })); setTpls(loadTemplates()); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.open]);

  const th = themeOf(cfg.themeKey);
  const sz = sizeOf(cfg.sizeKey);
  const set = (patch: Partial<BookConfig>) => setCfg((c) => ({ ...c, ...patch }));

  const between = useMemo(() => {
    const others = p.senders.filter((s) => s !== p.meName);
    if (p.senders.length > 2) return p.senders.slice(0, 4).join(', ');
    return p.meName && others[0] ? `${others[0]}  &  ${p.meName}` : (cfg.title || p.defaultTitle);
  }, [p.senders, p.meName, cfg.title, p.defaultTitle]);

  function doSaveTpl() {
    const name = tplName.trim();
    if (!name) return;
    setTpls(saveTemplate(name, cfg));
    setTplName('');
  }

  function applyTpl(tp: BookTemplate) {
    const title = cfg.title || tp.config.title;
    setCfg({ ...defaultBookConfig(title), ...tp.config, title });
  }
  function delTpl(name: string) { setTpls(deleteTemplate(name)); }

  const toggle = (key: keyof BookConfig, label: string) => (
    <label className="bk-toggle">
      <input type="checkbox" checked={cfg[key] as boolean} onChange={(e) => set({ [key]: e.target.checked } as Partial<BookConfig>)} />
      <span>{label}</span>
    </label>
  );

  const exclusiveToggle = (key: 'phoneFrame' | 'twoColumns', other: 'phoneFrame' | 'twoColumns', label: string) => (
    <label className="bk-toggle">
      <input type="checkbox" checked={cfg[key]}
        onChange={(e) => set(e.target.checked
          ? ({ [key]: true, [other]: false } as unknown as Partial<BookConfig>)
          : ({ [key]: false } as unknown as Partial<BookConfig>))} />
      <span>{label}</span>
    </label>
  );

  const weaveImg = weaveUrl(th);
  const vignette = vignetteBg(th);
  const range = p.dateRange || '';
  const colophon = [
    `${p.msgCount.toLocaleString()} messages`,
    `${p.days.toLocaleString()} ${p.days === 1 ? 'day' : 'days'}`,
    p.mediaCount ? `${p.mediaCount.toLocaleString()} photograph${p.mediaCount === 1 ? '' : 's'}` : '',
  ].filter(Boolean).join('   ·   ');

  const doodle = (ink: string) => "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><g fill='none' stroke='%23"
    + ink.replace('#', '')
    + "' stroke-width='2' stroke-linecap='round'><circle cx='20' cy='24' r='7'/><path d='M60 16 h22 v13 h-13 l-6 6 v-6 h-3 z'/><path d='M96 20 q6 -7 12 0'/><path d='M16 70 q7 -8 14 0'/><path d='M70 64 l4 8 8 1 -6 6 2 8 -8 -4 -8 4 2 -8 -6 -6 8 -1 z'/><rect x='96' y='62' width='18' height='14' rx='3'/><path d='M22 104 q7 -8 14 0'/><circle cx='92' cy='104' r='6'/></g></svg>\")";

  const plateBg: CSSProperties = cfg.showWallpaper
    ? { backgroundColor: th.chatBg, backgroundImage: doodle(th.doodleInk), backgroundSize: '54px 54px' }
    : { background: th.chatBg };

  const monthSample = (p.dateRange || '').split('—')[0].trim().split(/\s+/).slice(1).join(' ') || 'July 2026';

  const daySample = `9 ${monthSample}`;
  const SAMPLE = [
    { out: false, txt: 'Kal milte hai? ☕' }, { out: true, txt: 'Haan pakka 👍' },
    { out: false, txt: '', media: true }, { out: true, txt: 'Perfect 🔥' },
    { out: false, txt: 'Address bhej diya 📍' }, { out: true, txt: 'Mil jayega' },
  ];
  const bubble = (m: { out: boolean; txt: string; media?: boolean }, i: number) => (
    <div key={i} className={'bkm ' + (m.out ? 'out' : 'in')}>
      <div className="bkm-b" style={{ background: m.out ? '#d9fdd3' : '#fff' }}>
        {m.media ? <span className="bkm-media">📷</span> : <span>{m.txt}</span>}
        <span className="bkm-t">10:0{i}{m.out && <b> ✓✓</b>}</span>
      </div>
    </div>
  );
  const frameJsx = () => {
    const c = rgba(th.accent, 0.42), k = cfg.borderKey;
    if (k === 'none') return null;
    const corners = (['tl', 'tr', 'bl', 'br'] as const).map((pos) => {
      const s: CSSProperties = { borderColor: c };
      if (pos[0] === 't') { s.top = 5; s.borderBottom = 'none'; } else { s.bottom = 5; s.borderTop = 'none'; }
      if (pos[1] === 'l') { s.left = 5; s.borderRight = 'none'; } else { s.right = 5; s.borderLeft = 'none'; }
      return <span key={pos} className="bk-fc" style={s} />;
    });

    const edges = (['t', 'b', 'l', 'r'] as const).map((e) => {
      const s: CSSProperties = { background: th.accent };
      if (e === 't') { s.top = 4; s.left = '50%'; } else if (e === 'b') { s.bottom = 4; s.left = '50%'; }
      else if (e === 'l') { s.left = 4; s.top = '50%'; } else { s.right = 4; s.top = '50%'; }
      return <span key={e} className={'bk-fd ' + e} style={s} />;
    });
    if (k === 'corners') return <>{corners}</>;
    const s: CSSProperties = { borderColor: c };
    if (k === 'rounded') s.borderRadius = '9px';
    if (k === 'dotted') s.borderStyle = 'dotted';
    return (
      <>
        <span className="bk-fr" style={s} />
        {(k === 'double' || k === 'ornate') && <span className="bk-fr inner" style={{ borderColor: c }} />}
        {k === 'ornate' && <>{corners}{edges}</>}
      </>
    );
  };
  const insideTitle = cfg.title || p.defaultTitle;

  return (
    <div className={'hist' + (p.open ? ' show' : '')} onClick={(e) => { if (e.target === e.currentTarget && !p.exporting) p.onClose(); }}>
      <div className="hist-box bk-box" {...dialogProps} aria-label="Book Studio">
        <span className="x" onClick={() => !p.exporting && p.onClose()}>&times;</span>
        <h3>📖 {t('bkTitle')}</h3>

        <div className="bk-grid">

          <div className="bk-preview">
            <div className="bk-cover" style={{ background: th.cloth, color: th.foil, aspectRatio: `${sz.w}/${sz.h}` }}>
              <div className="bk-weave" style={{ backgroundImage: weaveImg }} />
              <div className="bk-vig" style={{ background: vignette }} />
              <div className="bk-spine" style={{ background: `linear-gradient(90deg,${th.clothEdge} 0%,${th.clothEdge} 55%,rgba(0,0,0,.20) 92%,rgba(255,255,255,.07) 100%)` }} />
              <div className="bk-fr1" style={{ borderColor: th.foil }} />
              <div className="bk-fr2" style={{ borderColor: th.foil }} />
              <div className="bk-stamp">
                {cfg.showAvatar && p.avatar && (
                  <div className="bk-plate">
                    <img src={p.avatar} alt="" />
                    <span className="bk-plate-ring" style={{ borderColor: th.foil }} />
                    <span className="bk-plate-halo" style={{ borderColor: th.foil }} />
                  </div>
                )}
                <div className="bk-rule" style={{ background: th.foil }} />
                <div className={'bk-ttl' + (cfg.serif ? ' serif' : ' sans')}>{cfg.title || p.defaultTitle}</div>
                {cfg.subtitle && <div className="bk-sub">{cfg.subtitle}</div>}
                <div className="bk-rule mt" style={{ background: th.foil }} />
                <div className="bk-who">{between}</div>
              </div>
              <div className="bk-foot">
                {range && <div className="bk-range">{range}</div>}
                {cfg.showStats && <div className="bk-colophon">{colophon}</div>}
              </div>
            </div>
            <div className="bk-preview-cap">{t('bkPreview')} · Cover</div>

            <div className="bk-inside" style={{ aspectRatio: `${sz.w}/${sz.h}`, background: th.paper }}>
              <span className="bk-gutter" />
              {frameJsx()}
              <div className="bk-rhead">
                <span className="bk-rh-who">{between}</span>
                <span className="bk-rh-chap" style={{ color: th.accent }}>{monthSample}</span>
              </div>
              <div className="bk-rrule" style={{ background: rgba(th.accent, 0.22) }}>
                <i style={{ background: th.accent }} />
              </div>
              {cfg.phoneFrame ? (
                <div className={'bk-ph' + (cfg.showPageNumbers ? '' : ' nofolio')}>
                  <div className="bk-ph-scr">
                    <div className="bk-ph-head">
                      <span className="bk-ph-back">‹</span>
                      {cfg.showAvatar && p.avatar
                        ? <img className="bk-ph-ava" src={p.avatar} alt="" />
                        : <span className="bk-ph-ava e">{insideTitle.slice(0, 1).toUpperCase()}</span>}
                      <span className="bk-ph-nm">{insideTitle}</span>
                      <span className="bk-ph-ic">⋮</span>
                    </div>
                    <div className="bk-ph-body" style={plateBg}>
                      {cfg.showChapters && <div className="bkm-day">Today</div>}
                      {SAMPLE.map(bubble)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className={'bk-chatplate' + (cfg.showPageNumbers ? '' : ' nofolio')} style={plateBg}>
                  {cfg.twoColumns ? (
                    <div className="bk-cols">
                      <div className="bk-col">{cfg.showChapters && <div className="bkm-day">{daySample}</div>}{SAMPLE.slice(0, 3).map(bubble)}</div>
                      <div className="bk-coldiv" />
                      <div className="bk-col">{SAMPLE.slice(3).map(bubble)}</div>
                    </div>
                  ) : (
                    <div className="bk-single">{cfg.showChapters && <div className="bkm-day">{daySample}</div>}{SAMPLE.map(bubble)}</div>
                  )}
                </div>
              )}
              {cfg.showPageNumbers && (
                <div className="bk-folio">
                  <i style={{ background: rgba(th.accent, 0.4) }} /><span>1</span><i style={{ background: rgba(th.accent, 0.4) }} />
                </div>
              )}
            </div>
            <div className="bk-preview-cap">Inside page</div>
          </div>

          <div className="bk-settings">
            <label className="bk-field">
              <span>{t('bkTitleLabel')}</span>
              <input value={cfg.title} onChange={(e) => set({ title: e.target.value })} placeholder={p.defaultTitle} maxLength={60} />
            </label>
            <label className="bk-field">
              <span>{t('bkSubtitle')}</span>
              <input value={cfg.subtitle} onChange={(e) => set({ subtitle: e.target.value })} maxLength={60} />
            </label>
            <label className="bk-field">
              <span>{t('bkDedication')}</span>
              <input value={cfg.dedication} onChange={(e) => set({ dedication: e.target.value })} placeholder={t('bkDedicationPh')} maxLength={120} />
            </label>

            <div className="bk-sec">{t('bkTheme')}</div>
            <div className="bk-themes">
              {BOOK_THEMES.map((tm) => (
                <button key={tm.key} className={'bk-sw' + (cfg.themeKey === tm.key ? ' on' : '')}
                  title={tm.name} onClick={() => set({ themeKey: tm.key })}>
                  <span className="bk-sw-dot" style={{ background: swatchCss(tm) }} />
                  <span className="bk-sw-nm">{tm.name}</span>
                </button>
              ))}
            </div>

            <div className="bk-sec">{t('bkBorder')}</div>
            <div className="bk-borders">
              {BOOK_BORDERS.map((b) => (
                <button key={b.key} className={'bk-bd' + (cfg.borderKey === b.key ? ' on' : '')}
                  onClick={() => set({ borderKey: b.key })}>{b.name}</button>
              ))}
            </div>

            <div className="bk-sec">{t('bkSize')}</div>
            <div className="bk-borders">
              {BOOK_SIZES.map((s) => (
                <button key={s.key} className={'bk-bd' + (cfg.sizeKey === s.key ? ' on' : '')}
                  title={`${s.w} × ${s.h} mm`} onClick={() => set({ sizeKey: s.key })}>{s.name}</button>
              ))}
            </div>

            <div className="bk-sec">{t('bkInclude')}</div>
            <div className="bk-toggles">
              {exclusiveToggle('phoneFrame', 'twoColumns', t('bkPhoneFrame'))}
              {exclusiveToggle('twoColumns', 'phoneFrame', t('bkTwoCol'))}
              {toggle('serif', t('bkSerif'))}
              {toggle('showWallpaper', t('bkWallpaper'))}
              {toggle('showCover', t('bkCoverPage'))}
              {toggle('showTitlePage', t('bkTitlePage'))}
              {toggle('showContents', t('bkContents'))}
              {toggle('showAvatar', t('bkAvatar'))}
              {toggle('showStats', t('bkStats'))}
              {toggle('showChapters', t('bkChapters'))}
              {toggle('showPageNumbers', t('bkPageNumbers'))}
              {toggle('showClosing', t('bkClosing'))}
            </div>
            {!cfg.twoColumns && p.msgCount > 1500 && <p className="bk-hint">{t('bkBigChatHint')}</p>}

            <div className="bk-sec">{t('bkTemplates')}</div>
            <div className="bk-tpl-save">
              <input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder={t('bkTplNamePh')} maxLength={30}
                onKeyDown={(e) => { if (e.key === 'Enter') doSaveTpl(); }} />
              <button className="bk-tpl-savebtn" onClick={doSaveTpl}>{t('bkSaveTpl')}</button>
            </div>
            {tpls.length > 0 ? (
              <div className="bk-tpl-list">
                {tpls.map((tp) => (
                  <div key={tp.name} className="bk-tpl">
                    <span className="bk-tpl-dot" style={{ background: swatchCss(themeOf(tp.config.themeKey)) }} />
                    <span className="bk-tpl-nm" title={t('bkApply')} onClick={() => applyTpl(tp)}>{tp.name}</span>
                    <button className="bk-tpl-del" title={t('hDelete')} onClick={() => delTpl(tp.name)}>🗑️</button>
                  </div>
                ))}
              </div>
            ) : <p className="bk-tpl-none">{t('bkNoTpl')}</p>}
          </div>
        </div>

        {p.exporting && p.progress && (
          <div className="bk-prog">
            <div className="bk-prog-bar">
              <span style={{ width: `${Math.round(100 * p.progress.done / Math.max(1, p.progress.total))}%` }} />
            </div>
            <div className="bk-prog-txt">
              <span>{t('bkBuilding').replace('{a}', String(p.progress.done)).replace('{b}', String(p.progress.total))}</span>
              <span className="bk-prog-note">{t('bkBuildWait')}</span>
            </div>
          </div>
        )}

        <div className="bk-actions">
          <button className="bk-cancel" disabled={p.exporting} onClick={p.onClose}>{t('bkClose')}</button>
          <button className="bk-export" disabled={p.exporting} onClick={() => p.onExport(cfg)}>
            {p.exporting ? <span className="btn-load"><span className="spinner btn" />{t('vActSaving')}</span> : `📖 ${t('bkExportPdf')}`}
          </button>
        </div>
      </div>
    </div>
  );
}
