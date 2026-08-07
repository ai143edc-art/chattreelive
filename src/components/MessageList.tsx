import { memo, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode, ReactElement } from 'react';
import * as P from '../lib/parser';
import type { Message } from '../lib/parser';
import { IconForward } from '../lib/icons';

interface Props {
  messages: Message[];
  meName: string | null;
  senders: string[];
  mediaMap: Record<string, string>;
  dateOrder: P.DateOrder;
  hiddenSet?: Set<number>;
  translations?: Record<number, string>;
  translated?: boolean;
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
  onOpenMedia: (url: string, kind: 'img' | 'video') => void;
}

const REACT_EMOJIS = ['❤️', '😂', '👍', '😮', '😢', '🙏'];
function RowTools({ onReply, onReact, onForward, onDelete }:
{ onReply: () => void; onReact: (e: string) => void; onForward: () => void; onDelete: () => void }) {
  const [pick, setPick] = useState(false);
  return (
    <span className="msg-tools">
      <button className="mt-btn" title="Reply" onClick={onReply}>↩</button>
      <span className="mt-react">
        <button className="mt-btn" title="React" onClick={() => setPick((v) => !v)}>😊</button>
        {pick && (
          <span className="react-pop">
            {REACT_EMOJIS.map((e) => <span key={e} onClick={() => { onReact(e); setPick(false); }}>{e}</span>)}
          </span>
        )}
      </span>
      <button className="mt-btn" title="Toggle Forwarded" onClick={onForward}>↪</button>
      <button className="mt-btn mt-del" title="Delete" onClick={onDelete}>🗑</button>
    </span>
  );
}

function Ticks({ tick, editMode, onClick }: { tick?: number; editMode?: boolean; onClick?: () => void }) {
  const tk = tick ?? 3;
  if (tk === 0 && !editMode) return null;
  const icon = tk === 0 ? '‹›' : tk === 1 ? '✓' : '✓✓';
  return (
    <span className={'tick' + (tk === 3 ? '' : ' gray') + (editMode ? ' tick-edit' : '')}
      onClick={editMode ? onClick : undefined} title={editMode ? 'Tap to change ticks' : undefined}>{icon}</span>
  );
}

function EditableText({ initial, onCommit }: { initial: string; onCommit: (t: string) => void }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => { if (ref.current) ref.current.innerText = initial; }, [initial]);
  return (
    <span
      ref={ref} className="txt editable-live" contentEditable suppressContentEditableWarning
      onBlur={(e) => onCommit(e.currentTarget.innerText)}
    />
  );
}

const docIcon = (ext: string) =>
  ext === 'pdf' ? '📕' : /(docx?|txt)/.test(ext) ? '📄' : /xlsx?/.test(ext) ? '📊' : ext === 'vcf' ? '👤' : '📎';

function renderMedia(url: string | undefined, ext: string, name: string, onOpenMedia: Props['onOpenMedia']): ReactElement {
  if (!url) return <span className="mediaph">{P.mediaLabel(ext)}</span>;
  if (/^(jpe?g|png|gif|webp|bmp|heic)$/.test(ext))
    return <img src={url} loading="lazy" alt="" onClick={() => onOpenMedia(url, 'img')} />;
  if (/^(mp4|3gp|mov|mkv|webm|avi)$/.test(ext))
    return <video src={url} controls preload="metadata" onClick={() => onOpenMedia(url, 'video')} />;
  if (/^(opus|mp3|aac|m4a|wav|ogg|amr)$/.test(ext))
    return <audio src={url} controls preload="none" />;
  return (
    <a className="doc" href={url} download={name} target="_blank" rel="noopener">
      <span className="ic">{docIcon(ext)}</span><span className="dn">{name}</span>
    </a>
  );
}

export interface RowProps {
  m: Message;
  mi: number;
  out: boolean;
  grp: boolean;
  isGroup: boolean;
  translation: string | null;
  mediaUrl: string | undefined;
  editMode?: boolean;
  onEditText?: (index: number, text: string) => void;
  onDeleteMsg?: (index: number) => void;
  onCycleTick?: (index: number) => void;
  onEditTime?: (index: number) => void;
  onReply?: (index: number) => void;
  onReact?: (index: number, emoji: string) => void;
  onForward?: (index: number) => void;
  onOpenMedia: Props['onOpenMedia'];
}

function RowInner({
  m, mi, out, grp, isGroup, translation, mediaUrl, editMode,
  onEditText, onDeleteMsg, onCycleTick, onEditTime, onReply, onReact, onForward, onOpenMedia,
}: RowProps) {
  const tr = translation;
  const idx = mi;

  let inner: ReactNode = null, mediaCls = '', extraCls = '', showFwd = false, editable = false;
  const att = m.call ? null : P.findAttachment(m.text);
  if (m.call) {
    extraCls = ' call';
    inner = (
      <span className="call-row">
        <span className={'call-ic' + (m.call.missed ? ' missed' : '')}>{m.call.media === 'video' ? '📹' : '📞'}</span>
        <span className="call-txt"><span className="call-title">{m.call.title}</span><span className="call-sub">{m.call.sub}</span></span>
      </span>
    );
  } else if (att) {
    const fkey = att.split('/').pop()!.toLowerCase();
    const url = mediaUrl;
    const ext = (fkey.match(/\.([a-z0-9]+)$/) || [])[1] || '';
    const cap = tr ?? P.extractCaption(m.text, att);
    const media = renderMedia(url, ext, att, onOpenMedia);
    showFwd = !!url;
    const isVisual = !!url && /^(jpe?g|png|gif|webp|bmp|heic|mp4|3gp|mov|mkv|webm|avi)$/.test(ext);
    if (cap) {
      inner = <>{media}<span className="txt" dangerouslySetInnerHTML={{ __html: P.formatText(cap) }} /></>;
    } else {
      inner = media;
      if (isVisual) mediaCls = ' media';
    }
  } else if (P.PLACEHOLDERS.test(m.text)) {
    inner = <span className="mediaph">{P.placeholderLabel(m.text)}</span>;
  } else if (editMode && onEditText) {
    editable = true;
    inner = <EditableText initial={P.stripMarks(m.text)} onCommit={(t) => onEditText(idx, t)} />;
  } else if (tr != null) {
    inner = <span className="txt" dangerouslySetInnerHTML={{ __html: P.formatText(tr) }} />;
  } else {
    const em = P.emojiInfo(m.text);
    if (em) { extraCls = ' emoji'; inner = <span className="txt">{P.stripMarks(m.text)}</span>; }
    else inner = <span className="txt" dangerouslySetInnerHTML={{ __html: P.formatText(m.text) }} />;
  }
  if (!inner) inner = <span className="mediaph">📎 Media</span>;

  const who = isGroup && !out && !grp
    ? <div className={'who ' + P.colorFor(m.sender!)}>{m.sender}</div> : null;

  return (
    <div className={`row ${out ? 'out' : 'in'}${grp ? ' grp' : ''}${editMode ? ' editmode' : ''}`} data-mi={mi}>
      {editMode && onDeleteMsg && (
        <RowTools onReply={() => onReply?.(idx)} onReact={(e) => onReact?.(idx, e)} onForward={() => onForward?.(idx)} onDelete={() => onDeleteMsg(idx)} />
      )}
      {isGroup && !out && (
        grp
          ? <span className="grp-ava sp" />
          : <span className="grp-ava" style={{ background: P.avatarColor(m.sender!) }}>{P.initial(m.sender!)}</span>
      )}
      <div className={`bubble${mediaCls}${extraCls}${editable ? ' editing' : ''}${m.reactions?.length ? ' has-react' : ''}`}>
        {m.forwarded && <div className="fwd-label">↪ Forwarded</div>}
        {m.reply && (
          <div className="reply-quote">
            <div className="rq-name">{m.reply.sender}</div>
            <div className="rq-text">{m.reply.text || '📎 media'}</div>
          </div>
        )}
        {who}{inner}
        {m.reactions && m.reactions.length > 0 && <span className="reactions">{m.reactions.join(' ')}</span>}
        <span className="meta2">
          {editMode
            ? <span className="time-edit" title="Tap to change time" onClick={() => onEditTime?.(idx)}>{P.shortTime(m.time)}</span>
            : P.shortTime(m.time)}
          {' '}{out && <Ticks tick={m.tick} editMode={editMode} onClick={() => onCycleTick?.(idx)} />}
        </span>
      </div>
      {showFwd && <span className="fwd" title="Forward"><IconForward /></span>}
    </div>
  );
}

export function rowPropsEqual(a: RowProps, b: RowProps): boolean {
  return a.m === b.m
    && a.mi === b.mi
    && a.out === b.out
    && a.grp === b.grp
    && a.isGroup === b.isGroup
    && a.translation === b.translation
    && a.mediaUrl === b.mediaUrl
    && a.editMode === b.editMode;
}

const Row = memo(RowInner, rowPropsEqual);

function MessageList({ messages, meName, senders, mediaMap, dateOrder, hiddenSet, translations, translated, editMode, onEditText, onDeleteMsg, onCycleTick, onEditTime, onEditDate, onReply, onReact, onForward, showTyping, onOpenMedia }: Props) {
  const isGroup = senders.length > 2;
  const nodes: ReactNode[] = [];
  let lastDate: string | null = null, prevSender: string | null = null, mi = -1;

  for (const m of messages) {
    mi++;

    if (hiddenSet?.has(mi)) continue;
    if (m.date !== lastDate) {
      const d = m.date;
      nodes.push(
        <div className={'day' + (editMode ? ' editable-day' : '')} key={`sep${mi}`}
          title={editMode ? 'Tap to change this date' : undefined}
          onClick={editMode ? () => onEditDate?.(d) : undefined}>{P.formatDay(m.date, dateOrder)}</div>,
      );
      lastDate = m.date; prevSender = null;
    }
    if (m.system || !m.sender) {
      const tr = translated && translations && translations[mi] != null ? translations[mi] : null;
      nodes.push(<div className="sys" key={mi} dangerouslySetInnerHTML={{ __html: P.formatText((tr ?? m.text).trim()) }} />);
      prevSender = null; continue;
    }
    const out = m.sender === meName;
    const grp = prevSender === m.sender;

    const att = m.call ? null : P.findAttachment(m.text);
    const mediaUrl = att ? mediaMap[att.split('/').pop()!.toLowerCase()] : undefined;
    nodes.push(
      <Row
        key={mi}
        m={m}
        mi={mi}
        out={out}
        grp={grp}
        isGroup={isGroup}
        translation={translated && translations && translations[mi] != null ? translations[mi] : null}
        mediaUrl={mediaUrl}
        editMode={editMode}
        onEditText={onEditText}
        onDeleteMsg={onDeleteMsg}
        onCycleTick={onCycleTick}
        onEditTime={onEditTime}
        onReply={onReply}
        onReact={onReact}
        onForward={onForward}
        onOpenMedia={onOpenMedia}
      />,
    );
    prevSender = m.sender;
  }

  if (showTyping) {
    nodes.push(
      <div className="row in" key="typing">
        <div className="bubble typing-bubble"><span className="td" /><span className="td" /><span className="td" /></div>
      </div>,
    );
  }

  if (!nodes.length) return (
    <div className="empty-note">
      {hiddenSet && hiddenSet.size ? 'No messages match your filter 🔎' : 'No messages could be parsed 🤔'}
    </div>
  );
  return <>{nodes}</>;
}

function listPropsEqual(a: Props, b: Props): boolean {
  return a.messages === b.messages
    && a.meName === b.meName
    && a.senders === b.senders
    && a.mediaMap === b.mediaMap
    && a.dateOrder === b.dateOrder
    && a.hiddenSet === b.hiddenSet
    && a.translations === b.translations
    && a.translated === b.translated
    && a.editMode === b.editMode
    && a.showTyping === b.showTyping;
}

export default memo(MessageList, listPropsEqual);
export { listPropsEqual };

export function applyHighlights(
  container: HTMLElement | null,
  matchSet: Set<number> | undefined,
  activeIndex: number,
): void {
  if (!container) return;
  container.querySelectorAll<HTMLElement>('.row[data-mi]').forEach((el) => {
    const mi = Number(el.dataset.mi);
    const on = !!matchSet && matchSet.has(mi);
    el.classList.toggle('hl', on);
    el.classList.toggle('hla', on && mi === activeIndex);
  });
}
