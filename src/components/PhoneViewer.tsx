import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Message, DateOrder } from '../lib/parser';
import type { PhoneModel } from '../lib/models';
import { IconAvatar, IconBack, IconVideo, IconCall, IconMenu, IconEmoji, IconClip, IconCamera, IconMic, IconSend } from '../lib/icons';
import MessageList, { applyHighlights } from './MessageList';
import { useLang } from '../lib/i18n';

interface Props {
  messages: Message[];
  meName: string | null;
  senders: string[];
  mediaMap: Record<string, string>;
  dateOrder: DateOrder;
  model: PhoneModel;
  theme: 'light' | 'dark';
  showFrame: boolean;
  layoutSignal: string;
  contactTitle: string;
  status: string;
  showStatusBar?: boolean;
  wallpaper: string;
  avatar: string | null;
  matchSet: Set<number>;
  hiddenSet?: Set<number>;
  translations?: Record<number, string>;
  translated?: boolean;
  onToggleTranslated?: () => void;
  filterActive?: boolean;
  visibleCount?: number;
  onClearFilter?: () => void;
  activeMsgIndex: number;
  editMode?: boolean;
  onEditText?: (index: number, text: string) => void;
  onDeleteMsg?: (index: number) => void;
  onCycleTick?: (index: number) => void;
  onEditTime?: (index: number) => void;
  onEditDate?: (date: string) => void;
  onReply?: (index: number) => void;
  onReact?: (index: number, emoji: string) => void;
  onForward?: (index: number) => void;
  showTyping?: boolean;
  compose?: {
    text: string;
    onText: (v: string) => void;
    side: 'me' | 'other';
    onToggleSide: () => void;
    onSend: () => void;
    replyTo?: { sender: string; text: string } | null;
    onCancelReply?: () => void;
    onAddMedia?: (file: File) => void;
    onInsert?: (type: string) => void;
  };
  search: string;
  onSearch: (v: string) => void;
  matchCount: number;
  matchPos: number;
  onPrevMatch: () => void;
  onNextMatch: () => void;
  onOpenMedia: (url: string, kind: 'img' | 'video') => void;
  actions?: {
    onStats: () => void;
    onGallery: () => void;
    onFilter: () => void;
    onTranslate: () => void;
    onExportImg: () => void;
    onExportPdf: () => void;
    onExportVideo: () => void;
    onExportBook: () => void;
    onSave: () => void;
    saving: boolean;
    onTheme: () => void;
    onFrame: () => void;
    showFrame: boolean;
    onNew: () => void;
  };
}

export default function PhoneViewer(props: Props) {
  const { t } = useLang();
  const { model, showFrame, theme, layoutSignal, contactTitle, status, wallpaper, avatar, activeMsgIndex } = props;
  const [box, setBox] = useState({ scale: 1, wrapW: model.w, wrapH: model.h, screenH: model.h });
  const [attachOpen, setAttachOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [insertOpen, setInsertOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const act = props.actions;
  const run = (fn: () => void) => { setAttachOpen(false); fn(); };
  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  useEffect(() => {
    if (activeMsgIndex < 0) return;
    const el = bodyRef.current?.querySelector(`[data-mi="${activeMsgIndex}"]`);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeMsgIndex]);

  useLayoutEffect(() => {
    applyHighlights(bodyRef.current, props.matchSet, activeMsgIndex);
  }, [props.matchSet, activeMsgIndex, props.messages, props.hiddenSet, props.translated, props.translations, props.editMode, props.showTyping]);

  useLayoutEffect(() => {
    const compute = () => {
      const framePad = showFrame ? 24 : 0;
      const availW = Math.max(220, window.innerWidth - 16);
      const tbH = document.querySelector('.toolbar')?.getBoundingClientRect().height || 120;
      const availH = Math.max(320, window.innerHeight - tbH - 56);
      const outerW = model.w + framePad;
      const scale = Math.min(1, availW / outerW, availH / (model.h + framePad));
      setBox({ scale, wrapW: outerW * scale, wrapH: (model.h + framePad) * scale, screenH: model.h });
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [model, showFrame, layoutSignal]);

  return (
    <div className="stage">
      <div className="phoneWrap" style={{ width: box.wrapW, height: box.wrapH }}>
        <div
          className={'phone ' + (showFrame ? '' : 'plain')}
          style={{ position: 'absolute', top: 0, left: '50%', transform: `translateX(-50%) scale(${box.scale})`, transformOrigin: 'top center' }}
        >
          <div className="notch" />
          <div className={'screen ' + theme} style={{ width: model.w, height: box.screenH }}>
            {props.showStatusBar !== false && (
              <div className="sys-bar">
                <span className="sys-time">{now}</span>
                <span className="sys-icons">
                  <svg viewBox="0 0 24 24" className="si">
                    <rect x="1" y="15" width="3.6" height="6" rx="1" />
                    <rect x="6.8" y="11" width="3.6" height="10" rx="1" />
                    <rect x="12.6" y="7" width="3.6" height="14" rx="1" />
                    <rect x="18.4" y="3" width="3.6" height="18" rx="1" />
                  </svg>
                  <svg viewBox="0 0 24 24" className="si"><path d="M12 21l3.6-4.5c-1-.8-2.3-1.3-3.6-1.3s-2.6.5-3.6 1.3L12 21zm0-16C7 5 2.7 7 0 10l2 2.5C4.4 9.7 8 8 12 8s7.6 1.7 10 4.5L24 10c-2.7-3-7-5-12-5z" /></svg>
                  <span className="sys-batt"><i style={{ width: '85%' }} /></span>
                  <span className="sys-pct">85%</span>
                </span>
              </div>
            )}
            <div className="wa-head">
              <span className="back"><IconBack /></span>
              <span className="ava">{avatar ? <img src={avatar} alt="" /> : <IconAvatar />}</span>
              <div className="meta">
                <div className="nm">{contactTitle}</div>
                {status && <div className="st">{status}</div>}
              </div>
              <div className="icons">
                <span><IconVideo /></span>
                <span><IconCall /></span>
                <span className="dots" style={{ cursor: 'pointer' }} onClick={() => setMenuOpen((v) => !v)}><IconMenu /></span>
              </div>
            </div>
            <div className="wa-body" ref={bodyRef} style={wallpaper ? { background: wallpaper } : undefined}>
              <MessageList
                messages={props.messages}
                meName={props.meName}
                senders={props.senders}
                mediaMap={props.mediaMap}
                dateOrder={props.dateOrder}
                hiddenSet={props.hiddenSet}
                translations={props.translations}
                translated={props.translated}
                editMode={props.editMode}
                onEditText={props.onEditText}
                onDeleteMsg={props.onDeleteMsg}
                onCycleTick={props.onCycleTick}
                onEditTime={props.onEditTime}
                onEditDate={props.onEditDate}
                onReply={props.onReply}
                onReact={props.onReact}
                onForward={props.onForward}
                showTyping={props.showTyping}
                onOpenMedia={props.onOpenMedia}
              />
            </div>
            {menuOpen && (
              <>
                <div className="ap-overlay" onClick={() => setMenuOpen(false)} />
                <div className="dots-menu">
                  <div className="dm-item" onClick={() => { setMenuOpen(false); bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                    {t('vJumpTop')}
                  </div>
                  <div className="dm-item" onClick={() => { setMenuOpen(false); bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' }); }}>
                    {t('vJumpLatest')}
                  </div>
                </div>
              </>
            )}
            {props.translated && !props.search && (
              <div className="wc-float trd" style={{ bottom: props.filterActive ? 104 : 66 }}>
                {t('vTranslated')}
                <span className="wc-clear" title={t('vShowOriginal')} onClick={props.onToggleTranslated}>↩</span>
              </div>
            )}
            {props.filterActive && !props.search && (
              <div className="wc-float filt">
                🔎 {props.visibleCount ?? 0} {t('vShown')}
                <span className="wc-clear" title={t('fClear')} onClick={props.onClearFilter}>✕</span>
              </div>
            )}
            {props.search && (
              <div className={'wc-float' + (props.matchCount ? '' : ' none')}>
                {props.matchCount ? `${props.matchPos + 1}/${props.matchCount}` : t('vNoResults')}
                {props.matchCount > 0 && <>
                  <button onClick={props.onPrevMatch} title="▲">▲</button>
                  <button onClick={props.onNextMatch} title="▼">▼</button>
                </>}
                <span className="wc-clear" title="✕" onClick={() => props.onSearch('')}>✕</span>
              </div>
            )}
            {attachOpen && act && (
              <>
                <div className="ap-overlay" onClick={() => setAttachOpen(false)} />
                <div className="attach-pop">
                  <div className="ap-item" onClick={() => run(act.onStats)}><span className="ap-circle" style={{ background: '#009de2' }}>📊</span>{t('vActStats')}</div>
                  <div className="ap-item" onClick={() => run(act.onGallery)}><span className="ap-circle" style={{ background: '#0aa2c0' }}>📸</span>{t('vActGallery')}</div>
                  <div className="ap-item" onClick={() => run(act.onFilter)}><span className="ap-circle" style={{ background: '#6c8ae4' }}>🔎</span>{t('vActFilter')}</div>
                  <div className="ap-item" onClick={() => run(act.onTranslate)}><span className="ap-circle" style={{ background: '#2aa86b' }}>🌐</span>{t('vActTranslate')}</div>
                  <div className="ap-item" onClick={() => run(act.onExportImg)}><span className="ap-circle" style={{ background: '#bf59cf' }}>🖼️</span>{t('vActImage')}</div>
                  <div className="ap-item" onClick={() => run(act.onExportPdf)}><span className="ap-circle" style={{ background: '#d3396d' }}>📄</span>{t('vActPdf')}</div>
                  <div className="ap-item" onClick={() => run(act.onExportVideo)}><span className="ap-circle" style={{ background: '#0a8f68' }}>🎬</span>{t('vActVideo')}</div>
                  <div className="ap-item" onClick={() => run(act.onExportBook)}><span className="ap-circle" style={{ background: '#8a5a2b' }}>📖</span>{t('vActBook')}</div>
                  <div className="ap-item" onClick={() => run(act.onSave)}><span className="ap-circle" style={{ background: '#47c467' }}>{act.saving ? <span className="spinner btn" /> : '☁️'}</span>{act.saving ? t('vActSaving') : t('vActSave')}</div>
                  <div className="ap-item" onClick={() => run(act.onTheme)}><span className="ap-circle" style={{ background: '#7f66fe' }}>{theme === 'dark' ? '🌙' : '☀️'}</span>{t('vActTheme')}</div>
                  <div className="ap-item" onClick={() => run(act.onFrame)}><span className="ap-circle" style={{ background: '#e6774d' }}>📱</span>{t('vActFrame')} {act.showFrame ? t('on') : t('off')}</div>
                  <div className="ap-item" onClick={() => run(act.onNew)}><span className="ap-circle" style={{ background: '#26a69a' }}>↺</span>{t('vActNew')}</div>
                </div>
              </>
            )}
            {props.editMode && props.compose ? (
              <div className="wa-compose compose-col">
                {props.compose.replyTo && (
                  <div className="reply-preview">
                    <div className="rp-body">
                      <div className="rq-name">{props.compose.replyTo.sender}</div>
                      <div className="rq-text">{props.compose.replyTo.text || `📎 ${t('vMedia')}`}</div>
                    </div>
                    <span className="rp-x" onClick={props.compose.onCancelReply}>✕</span>
                  </div>
                )}
                <div className="compose-row">
                <span className="ins-wrap">
                  <button className="side-toggle" title={t('vInsertTitle')} onClick={() => setInsertOpen((v) => !v)}>＋</button>
                  {insertOpen && (
                    <>
                      <div className="ap-overlay" onClick={() => setInsertOpen(false)} />
                      <div className="ins-menu">
                        {[
                          ['call-missed', t('vInsMissed')],
                          ['call-voice', t('vInsVoice')],
                          ['call-video', t('vInsVideo')],
                          ['encrypt', t('vInsEncrypt')],
                          ['deleted', t('vInsDeleted')],
                          ['system', t('vInsSystem')],
                        ].map(([type, label]) => (
                          <div key={type} className="dm-item" onClick={() => { setInsertOpen(false); props.compose!.onInsert?.(type); }}>{label}</div>
                        ))}
                      </div>
                    </>
                  )}
                </span>
                <button className="side-toggle" title={t('vWhoSending')} onClick={props.compose.onToggleSide}>
                  {props.compose.side === 'me' ? t('vSideYou') : t('vSideThem')}
                </button>
                <div className="wa-input">
                  <span className="wc-ic"><IconEmoji /></span>
                  <input
                    value={props.compose.text} placeholder={t('vComposePh')}
                    onChange={(e) => props.compose!.onText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); props.compose!.onSend(); } }}
                  />
                  <label className="wc-ic clip" title={t('vAddPhoto')} style={{ cursor: 'pointer' }}>
                    <input type="file" accept="image/*,video/*" hidden
                      onChange={(e) => { const f = e.target.files?.[0]; e.currentTarget.value = ''; if (f) props.compose!.onAddMedia?.(f); }} />
                    <IconClip />
                  </label>
                </div>
                <button className="wc-btn" title={t('vAddMsg')} onClick={props.compose.onSend}><IconSend /></button>
                </div>
              </div>
            ) : (
              <div className="wa-compose">
                <div className="wa-input">
                  <span className="wc-ic"><IconEmoji /></span>
                  <input
                    value={props.search} placeholder="Message"
                    onChange={(e) => props.onSearch(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && props.matchCount) props.onNextMatch(); }}
                  />
                  <span className="wc-ic clip" onClick={() => act && setAttachOpen((v) => !v)} style={act ? { cursor: 'pointer' } : undefined}><IconClip /></span>
                  {!props.search && <span className="wc-ic"><IconCamera /></span>}
                </div>
                <button
                  className="wc-btn" title={props.search ? '▼' : t('vActions')}
                  onClick={() => {
                    if (props.search && props.matchCount) props.onNextMatch();
                    else if (!props.search && act) setAttachOpen((v) => !v);
                  }}
                >
                  {props.search ? <IconSend /> : <IconMic />}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="cap">📱 {model.name} · <span>{model.w} × {model.h} px</span></div>
    </div>
  );
}
