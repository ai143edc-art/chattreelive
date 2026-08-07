import { useEffect, useMemo, useRef, useState } from 'react';
import { findAttachment, extractCaption, mediaLabel, placeholderLabel, PLACEHOLDERS, type Message } from '../lib/parser';
import { useLang } from '../lib/i18n';
import type { TKey } from '../lib/i18n';
type T = (k: TKey) => string;
import {
  createRoom, joinRoom, postMessage, subscribeRoom, fetchRoomMessages, uploadRoomMedia,
  reactMessage, deleteMessage, subscribeTyping, roomSync, rememberRoom,
  uploadImportedMedia, setRoomHistory,
  type RoomMessage, type Reaction, type ReplyTo, type Side, type HistoryMessage,
} from '../lib/rooms';
import { useCall } from '../lib/webrtcCall';
import CallOverlay from './CallOverlay';

interface Props {
  mode: 'create' | 'join';
  importedMessages?: Message[];
  importedSenders?: string[];
  importedMedia?: Record<string, Blob>;
  roomId?: string;
  autoPin?: string;
  userEmail: string | null;
  onLogin: () => void;
  onHome: () => void;
}

interface ActiveRoom { id: string; pin: string; side: Side; myName: string; otherName: string; history: HistoryMessage[] }
interface Line {
  id?: number; name: string; text: string; time?: string; mine: boolean;
  mediaUrl?: string | null; mediaType?: string | null; mediaName?: string | null;
  reactions?: Reaction[]; replyName?: string | null; replyText?: string | null; deleted?: boolean;
}

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

function fmtTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function aggReactions(rs?: Reaction[]): { emoji: string; count: number }[] {
  if (!rs || !rs.length) return [];
  const map = new Map<string, number>();
  for (const r of rs) map.set(r.emoji, (map.get(r.emoji) || 0) + 1);
  return [...map.entries()].map(([emoji, count]) => ({ emoji, count }));
}
function previewOf(l: Line, t: T): string {
  if (l.deleted) return t('ccPvDeleted');
  if (l.mediaType === 'image') return t('ccPvPhoto');
  if (l.mediaType === 'video') return t('ccPvVideo');
  if (l.mediaType === 'audio') return t('ccPvVoice');
  if (l.mediaType === 'file') return `📄 ${l.mediaName || t('ccDocument')}`;
  return l.text.length > 60 ? `${l.text.slice(0, 60)}…` : l.text;
}
function fmtLastSeen(iso: string, t: T, lang: string): string {
  const d = new Date(iso); const now = new Date();
  if ((now.getTime() - d.getTime()) / 1000 < 60) return t('ccJustNow');
  const tm = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  let day: string;
  if (d.toDateString() === now.toDateString()) day = t('ccToday');
  else {
    const y = new Date(now); y.setDate(now.getDate() - 1);
    day = d.toDateString() === y.toDateString() ? t('ccYesterday') : d.toLocaleDateString([], { day: '2-digit', month: 'short' });
  }
  return lang === 'hi' ? `${day} ${tm}` : `${day} at ${tm}`;
}

export default function ContinueChat({ mode, importedMessages, importedSenders, importedMedia, roomId: joinId, autoPin, userEmail, onLogin, onHome }: Props) {
  const { t, lang } = useLang();
  const senders = useMemo(() => importedSenders || [], [importedSenders]);
  const [phase, setPhase] = useState<'setup' | 'join' | 'chat'>(mode === 'create' ? 'setup' : 'join');
  const [room, setRoom] = useState<ActiveRoom | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadProg, setUploadProg] = useState<{ d: number; t: number } | null>(null);
  const [shotBusy, setShotBusy] = useState(false);
  const [err, setErr] = useState('');

  const [myName, setMyName] = useState(senders[senders.length - 1] || 'You');

  const [otherName, setOtherName] = useState(senders.find((s) => s !== (senders[senders.length - 1] || '')) || '');
  const [pin, setPin] = useState('');
  const [joinPin, setJoinPin] = useState('');

  const [live, setLive] = useState<RoomMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const [sendingMedia, setSendingMedia] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ReplyTo | null>(null);
  const [otherTyping, setOtherTyping] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const [otherSeenAt, setOtherSeenAt] = useState<string | null>(null);
  const [otherReadUpto, setOtherReadUpto] = useState(0);

  const bodyRef = useRef<HTMLDivElement>(null);
  const typingApi = useRef<{ notify: () => void; unsub: () => void } | null>(null);
  const typingClear = useRef<number | undefined>(undefined);
  const maxReadRef = useRef(0);
  const syncRef = useRef<() => void>(() => {});
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cancelRef = useRef(false);
  const recTimer = useRef<number | undefined>(undefined);
  const call = useCall(room?.id ?? null, room?.side ?? 'guest');

  useEffect(() => {
    if (phase !== 'chat' || !room) return;
    let alive = true;

    const merge = (prev: RoomMessage[], m: RoomMessage) => {
      const i = prev.findIndex((x) => x.id === m.id);
      if (i === -1) return [...prev, m].sort((a, b) => (a.id || 0) - (b.id || 0));
      const copy = prev.slice(); copy[i] = m; return copy;
    };
    const unsub = subscribeRoom(room.id, (m) => setLive((prev) => merge(prev, m)));
    fetchRoomMessages(room.id).then((past) => { if (alive) setLive((prev) => past.reduce(merge, prev)); }).catch(() => {});

    const tp = subscribeTyping(room.id, room.myName, (name) => {
      if (name === room.myName) return;
      setOtherTyping(name);
      window.clearTimeout(typingClear.current);
      typingClear.current = window.setTimeout(() => setOtherTyping(null), 2500);
    });
    typingApi.current = tp;

    const sync = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      roomSync(room.id, room.pin, room.side, maxReadRef.current)
        .then((s) => { if (alive) { setOtherSeenAt(s.otherSeenAt); setOtherReadUpto(s.otherReadUpto); } })
        .catch(() => {});
    };
    syncRef.current = sync;
    sync();
    const hb = window.setInterval(sync, 5000);
    const onVis = () => { if (document.visibilityState === 'visible') sync(); };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      alive = false; unsub(); tp.unsub(); typingApi.current = null;
      window.clearTimeout(typingClear.current); window.clearInterval(hb);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [phase, room]);

  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [live, phase, otherTyping]);

  useEffect(() => {
    if (phase !== 'chat') return;
    const maxId = live.reduce((m, x) => Math.max(m, x.id || 0), 0);
    if (maxId > maxReadRef.current && (typeof document === 'undefined' || document.visibilityState === 'visible')) {
      maxReadRef.current = maxId;
      syncRef.current();
    }
  }, [live, phase]);

  async function doCreate() {
    setErr('');
    if (!userEmail) { onLogin(); return; }
    if (pin.trim().length < 4) { setErr(t('ccErrPinShort')); return; }
    const myNm = myName.trim() || 'You';
    const otherNm = (senders.length >= 2 ? senders.find((s) => s !== myNm) : otherName.trim()) || 'Guest';
    setBusy(true);
    try {
      const id = await createRoom(pin.trim(), myNm, otherNm, importedMessages || []);

      let history: HistoryMessage[] = (importedMessages || []) as HistoryMessage[];
      if (importedMedia && Object.keys(importedMedia).length) {
        const res = await uploadImportedMedia(id, importedMessages || [], importedMedia, (d, t) => setUploadProg({ d, t }));
        history = res.history;
        if (res.changed) await setRoomHistory(id, pin.trim(), history);
        setUploadProg(null);
      }
      setRoom({ id, pin: pin.trim(), side: 'creator', myName: myNm, otherName: otherNm, history });
      rememberRoom({ id, pin: pin.trim(), myName: myNm, otherName: otherNm, isCreator: true });
      setPhase('chat');
    } catch (e) { setErr((e as Error).message || String(e)); } finally { setBusy(false); }
  }

  async function doJoin(pinArg?: string) {
    setErr('');
    if (!joinId) return;
    const usePin = (pinArg ?? joinPin).trim();
    if (usePin.length < 4) { setErr(t('ccErrEnterPin')); return; }
    setBusy(true);
    try {
      const info = await joinRoom(joinId, usePin);
      if (!info) { setErr(t('ccErrWrongPin')); return; }
      const side: Side = info.isCreator ? 'creator' : 'guest';
      const myNm = info.isCreator ? info.creatorName : info.guestName;
      const otherNm = info.isCreator ? info.guestName : info.creatorName;
      setRoom({ id: joinId, pin: usePin, side, myName: myNm, otherName: otherNm, history: info.history });
      rememberRoom({ id: joinId, pin: usePin, myName: myNm, otherName: otherNm, isCreator: info.isCreator });
      setPhase('chat');
    } catch (e) { setErr((e as Error).message || String(e)); } finally { setBusy(false); }
  }

  useEffect(() => {
    if (mode === 'join' && autoPin && phase === 'join' && !room) doJoin(autoPin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== 'chat' || !room) return;
    const u = new URL(window.location.href);
    if (u.searchParams.get('room') !== room.id) {
      u.searchParams.set('room', room.id);
      window.history.replaceState(window.history.state, '', u);
    }
  }, [phase, room]);

  async function send() {
    if (!room || !draft.trim()) return;
    const body = draft.trim(); const rep = replyTo;
    setDraft(''); setReplyTo(null);
    try { await postMessage(room.id, room.pin, room.side, room.myName, body, undefined, rep); }
    catch (e) { setErr((e as Error).message || String(e)); setDraft(body); setReplyTo(rep); }
  }

  async function sendFile(file: File) {
    if (!room) return;
    const rep = replyTo; setReplyTo(null);
    setErr(''); setSendingMedia(true);
    try {
      const media = await uploadRoomMedia(room.id, file);
      await postMessage(room.id, room.pin, room.side, room.myName, '', media, rep);
    } catch (e) { setErr((e as Error).message || String(e)); } finally { setSendingMedia(false); }
  }

  async function react(messageId: number, emoji: string) {
    if (!room) return;
    setMenuFor(null);
    try { await reactMessage(room.id, room.pin, messageId, room.myName, emoji); }
    catch (e) { setErr((e as Error).message || String(e)); }
  }

  async function del(messageId: number) {
    if (!room) return;
    setMenuFor(null);
    try { await deleteMessage(room.id, room.pin, messageId, room.myName); }
    catch (e) { setErr((e as Error).message || String(e)); }
  }

  function doReply(l: Line) { setReplyTo({ name: l.name, text: previewOf(l, t) }); setMenuFor(null); }

  async function startRec() {
    if (recording || sendingMedia) return;
    setErr(''); setMenuFor(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const canWebm = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm');
      const mr = new MediaRecorder(stream, canWebm ? { mimeType: 'audio/webm' } : undefined);
      chunksRef.current = []; cancelRef.current = false;
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        window.clearInterval(recTimer.current);
        if (cancelRef.current) { cancelRef.current = false; return; }
        const type = mr.mimeType || 'audio/webm';
        const ext = type.includes('mp4') || type.includes('m4a') ? 'm4a' : 'webm';
        const f = new File([new Blob(chunksRef.current, { type })], `voice-${Date.now()}.${ext}`, { type });
        sendFile(f);
      };
      mr.start();
      recRef.current = mr; setRecording(true); setRecSecs(0);
      recTimer.current = window.setInterval(() => setRecSecs((s) => s + 1), 1000);
    } catch { setErr(t('ccMicPerm')); }
  }
  function stopRec(cancel: boolean) {
    const mr = recRef.current;
    if (!mr) return;
    cancelRef.current = cancel;
    recRef.current = null; setRecording(false);
    try { mr.stop(); } catch {  }
  }

  const shareLink = room ? `${location.origin}/?room=${room.id}` : '';
  function copyLink() { navigator.clipboard?.writeText(`${shareLink}\nPIN: ${room?.pin}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }); }

  async function screenshot() {
    const el = bodyRef.current;
    if (!el || shotBusy) return;
    setShotBusy(true);
    setMenuFor(null);
    const prevH = el.style.height, prevMax = el.style.maxHeight, prevOv = el.style.overflowY, prevFlex = el.style.flex;
    try {
      const { default: html2canvas } = await import('html2canvas');
      el.style.flex = 'none'; el.style.height = 'auto'; el.style.maxHeight = 'none'; el.style.overflowY = 'visible';
      const canvas = await html2canvas(el, { backgroundColor: '#eae6df', scale: 2, useCORS: true, logging: false });
      await new Promise<void>((res) => canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = `chat-tree-${room?.otherName || 'chat'}-${Date.now()}.png`.replace(/\s+/g, '-');
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1500);
        }
        res();
      }, 'image/png'));
    } catch (e) { setErr((e as Error).message || String(e)); }
    finally {
      el.style.height = prevH; el.style.maxHeight = prevMax; el.style.overflowY = prevOv; el.style.flex = prevFlex;
      setShotBusy(false);
    }
  }

  const lines: Line[] = room ? [
    ...room.history.filter((m) => !m.system && m.sender).map((m): Line => {
      const mine = m.sender === room.myName;
      const att = findAttachment(m.text);

      if (m.mediaUrl) return { name: m.sender!, text: att ? extractCaption(m.text, att) : m.text, time: m.time, mine, mediaUrl: m.mediaUrl, mediaType: m.mediaType, mediaName: m.mediaName };

      if (att) { const cap = extractCaption(m.text, att); return { name: m.sender!, text: `${mediaLabel(att.split('.').pop() || '')}${cap ? `  ${cap}` : ''}`, time: m.time, mine }; }
      if (PLACEHOLDERS.test(m.text)) return { name: m.sender!, text: placeholderLabel(m.text), time: m.time, mine };
      return { name: m.sender!, text: m.text, time: m.time, mine };
    }),
    ...live.map((m): Line => ({
      id: m.id, name: m.senderName, text: m.body, time: fmtTime(m.createdAt), mine: m.sender === room.side,
      mediaUrl: m.mediaUrl, mediaType: m.mediaType, mediaName: m.mediaName, reactions: m.reactions,
      replyName: m.replyName, replyText: m.replyText, deleted: m.deleted,
    })),
  ] : [];

  const keyOf = (l: Line, i: number) => (l.id != null ? `m${l.id}` : `h${i}`);
  const mmss = `${Math.floor(recSecs / 60)}:${String(recSecs % 60).padStart(2, '0')}`;
  const otherOnline = !!otherSeenAt && Date.now() - new Date(otherSeenAt).getTime() < 20000;
  const statusText = otherTyping ? t('stTyping') : otherOnline ? t('stOnline') : otherSeenAt ? `${t('ccLastSeen')} ${fmtLastSeen(otherSeenAt, t, lang)}` : '';

  const wrap: React.CSSProperties = { maxWidth: 520, margin: '0 auto', padding: '20px 16px' };
  const input: React.CSSProperties = { width: '100%', padding: '12px 14px', border: '1px solid #d7ded9', borderRadius: 10, fontSize: 16, boxSizing: 'border-box' };
  const btn: React.CSSProperties = { background: 'linear-gradient(135deg,#25d366,#128c7e)', color: '#fff', border: 'none', borderRadius: 24, padding: '12px 22px', fontWeight: 700, fontSize: 16, cursor: 'pointer' };
  const circle: React.CSSProperties = { ...btn, borderRadius: '50%', width: 46, height: 46, padding: 0, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 };

  return (
    <div style={{ minHeight: '100dvh', background: '#eae6df' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 30, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', background: '#fff', borderBottom: '1px solid #e6ebe9' }}>
        <span style={{ fontWeight: 800, color: '#128c7e', cursor: 'pointer' }} onClick={onHome}>💬 Chat Tree</span>
        {phase === 'chat' && room ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={screenshot} disabled={shotBusy} title={t('ccScreenshot')} aria-label={t('ccScreenshot')}
              style={{ background: 'none', border: 'none', cursor: shotBusy ? 'default' : 'pointer', fontSize: 19, padding: 2, lineHeight: 1, opacity: shotBusy ? 0.5 : 1 }}>{shotBusy ? '⏳' : '📸'}</button>
            <button onClick={() => call.start(false)} title={t('callVoice')} aria-label={t('callVoice')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 19, padding: 2, lineHeight: 1 }}>📞</button>
            <button onClick={() => call.start(true)} title={t('callVideo')} aria-label={t('callVideo')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 19, padding: 2, lineHeight: 1 }}>📹</button>
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.15 }}>
              <b style={{ fontSize: 14, color: '#111b21' }}>{room.otherName}</b>
              {statusText && <span style={{ fontSize: 12, color: otherOnline || otherTyping ? '#25904f' : '#54656f' }}>{statusText}</span>}
            </span>
          </span>
        ) : <span style={{ fontSize: 13, color: '#54656f' }}>{t('ccLiveTag')}</span>}
      </header>

      {phase === 'setup' && (
        <div style={wrap}>
          <h2 style={{ margin: '6px 0' }}>{t('ccSetupTitle')}</h2>
          <p style={{ color: '#54656f', marginTop: 0 }}>{importedMessages && importedMessages.length
            ? t('ccImportedMsgs').replace('{n}', String(importedMessages.length))
            : t('ccFreshIntro')}</p>
          {!userEmail && (
            <div style={{ background: '#fff8e6', border: '1px solid #f2e2b6', borderRadius: 10, padding: 14, margin: '14px 0', color: '#6b5a2a' }}>
              {t('ccLoginPre')} <a role="button" style={{ color: '#128c7e', fontWeight: 700, cursor: 'pointer' }} onClick={onLogin}>{t('logIn')}</a> {t('ccLoginPost')}
            </div>
          )}
          {senders.length >= 2 ? (
            <>
              <label style={{ fontWeight: 600, fontSize: 14 }}>{t('ccWhichName')}</label>
              <select style={{ ...input, margin: '6px 0 16px' }} value={myName} onChange={(e) => setMyName(e.target.value)}>
                {senders.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </>
          ) : (
            <>
              <label style={{ fontWeight: 600, fontSize: 14 }}>{t('ccYourName')}</label>
              <input style={{ ...input, margin: '6px 0 12px' }} value={myName} onChange={(e) => setMyName(e.target.value)} placeholder={t('ccYourName')} />
              <label style={{ fontWeight: 600, fontSize: 14 }}>{t('ccTheirName')}</label>
              <input style={{ ...input, margin: '6px 0 16px' }} value={otherName} onChange={(e) => setOtherName(e.target.value)} placeholder={t('ccTheirName')} />
            </>
          )}
          <label style={{ fontWeight: 600, fontSize: 14 }}>{t('ccSetPin')}</label>
          <input style={{ ...input, margin: '6px 0 16px' }} value={pin} onChange={(e) => setPin(e.target.value)} placeholder={t('ccPinEg')} inputMode="numeric" />
          <button style={{ ...btn, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={doCreate}>
            {busy ? (uploadProg ? `${t('ccUploadingMedia')} ${uploadProg.d}/${uploadProg.t}` : t('ccCreating')) : t('ccCreateLink')}
          </button>
          {err && <div style={{ color: '#d3396d', marginTop: 12 }}>{err}</div>}
        </div>
      )}

      {phase === 'join' && (
        <div style={wrap}>
          {autoPin && !err ? (

            <div style={{ textAlign: 'center', padding: '44px 0', color: '#54656f' }}>
              <span className="spinner" style={{ margin: '0 auto 14px' }} />
              <p style={{ margin: 0 }}>{t('ccReopening')}</p>
            </div>
          ) : (
            <>
              <h2 style={{ margin: '6px 0' }}>{t('ccJoinTitle')}</h2>
              <p style={{ color: '#54656f', marginTop: 0 }}>{t('ccJoinSub')}</p>
              <input style={{ ...input, margin: '10px 0 16px', letterSpacing: 3, textAlign: 'center', fontSize: 20 }} value={joinPin} onChange={(e) => setJoinPin(e.target.value)} placeholder={t('ccPin')} inputMode="numeric"
                onKeyDown={(e) => { if (e.key === 'Enter') doJoin(); }} />
              <button style={{ ...btn, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => doJoin()}>{busy ? t('ccJoining') : t('ccJoinBtn')}</button>
              {err && <div style={{ color: '#d3396d', marginTop: 12 }}>{err}</div>}
            </>
          )}
        </div>
      )}

      {phase === 'chat' && room && (
        <div style={{ maxWidth: 520, margin: '0 auto', display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 49px)' }}>
          {room.side === 'creator' && (
            <div style={{ background: '#d9fdd3', padding: '10px 14px', fontSize: 13.5, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span>{t('ccShareInvite')} <b>{room.otherName}</b>:</span>
              <code style={{ background: '#fff', padding: '2px 6px', borderRadius: 6, wordBreak: 'break-all' }}>{shareLink}</code>
              <span>{t('ccPin')} <b>{room.pin}</b></span>
              <button style={{ ...btn, padding: '5px 12px', fontSize: 13, borderRadius: 16 }} onClick={copyLink}>{copied ? t('ccCopied') : t('ccCopy')}</button>
            </div>
          )}

          <div ref={bodyRef} onClick={() => setMenuFor(null)} style={{ flex: 1, overflowY: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {lines.map((l, i) => {
              const rx = aggReactions(l.reactions);
              const canReact = typeof l.id === 'number';
              const k = keyOf(l, i);
              return (
                <div key={k} style={{ alignSelf: l.mine ? 'flex-end' : 'flex-start', maxWidth: '80%', position: 'relative', marginBottom: rx.length ? 12 : 0 }}>
                  <div
                    onClick={(e) => { e.stopPropagation(); if (!l.deleted) setMenuFor(menuFor === k ? null : k); }}
                    style={{ background: l.mine ? '#d9fdd3' : '#fff', borderRadius: 10, padding: '7px 11px', boxShadow: '0 1px 1px rgba(0,0,0,.08)', fontSize: 15, whiteSpace: 'pre-wrap', wordBreak: 'break-word', cursor: l.deleted ? 'default' : 'pointer' }}
                  >
                    {!l.mine && <div style={{ fontSize: 12, fontWeight: 700, color: '#128c7e' }}>{l.name}</div>}

                    {l.replyName && !l.deleted && (
                      <div style={{ borderLeft: '3px solid #25d366', background: l.mine ? '#c9f2c0' : '#f0f2f5', borderRadius: 6, padding: '3px 8px', marginBottom: 4 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#128c7e' }}>{l.replyName}</div>
                        <div style={{ fontSize: 13, color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240 }}>{l.replyText}</div>
                      </div>
                    )}

                    {l.deleted ? (
                      <span style={{ fontStyle: 'italic', color: '#8696a0' }}>{t('ccDeletedMsg')}</span>
                    ) : (
                      <>
                        {l.mediaUrl && l.mediaType === 'image' && <img src={l.mediaUrl} alt="" style={{ maxWidth: '100%', borderRadius: 8, display: 'block', marginBottom: l.text ? 4 : 0 }} />}
                        {l.mediaUrl && l.mediaType === 'video' && <video src={l.mediaUrl} controls style={{ maxWidth: '100%', borderRadius: 8, display: 'block', marginBottom: l.text ? 4 : 0 }} />}
                        {l.mediaUrl && l.mediaType === 'audio' && <audio src={l.mediaUrl} controls style={{ maxWidth: 220, display: 'block', marginBottom: l.text ? 4 : 0 }} />}
                        {l.mediaUrl && l.mediaType === 'file' && (
                          <a href={l.mediaUrl} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0a6b5b', fontWeight: 600, textDecoration: 'none', background: '#f5f6f6', borderRadius: 8, padding: '8px 10px', marginBottom: l.text ? 4 : 0 }}>
                            <span style={{ fontSize: 22 }}>📄</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{l.mediaName || t('ccDocument')}</span>
                          </a>
                        )}
                        {l.text}
                      </>
                    )}
                    {l.time && (
                      <span style={{ float: 'right', marginLeft: 8, position: 'relative', top: 3, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <span style={{ fontSize: 10.5, color: '#8696a0' }}>{l.time}</span>
                        {l.mine && l.id != null && !l.deleted && (
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: otherReadUpto >= l.id ? '#53bdeb' : '#8696a0' }}>✓✓</span>
                        )}
                      </span>
                    )}
                  </div>

                  {rx.length > 0 && (
                    <div style={{ position: 'absolute', bottom: -11, left: l.mine ? 'auto' : 8, right: l.mine ? 8 : 'auto', display: 'flex', gap: 2, background: '#fff', border: '1px solid #eceff1', borderRadius: 12, padding: '1px 6px', boxShadow: '0 1px 2px rgba(0,0,0,.14)', fontSize: 12.5, lineHeight: 1.5 }}>
                      {rx.map((r) => <span key={r.emoji}>{r.emoji}{r.count > 1 ? ` ${r.count}` : ''}</span>)}
                    </div>
                  )}

                  {menuFor === k && !l.deleted && (
                    <div style={{ position: 'absolute', top: -62, left: l.mine ? 'auto' : 0, right: l.mine ? 0 : 'auto', background: '#fff', borderRadius: 18, padding: '7px 11px', boxShadow: '0 3px 14px rgba(0,0,0,.22)', zIndex: 6, display: 'flex', flexDirection: 'column', gap: 6, alignItems: l.mine ? 'flex-end' : 'flex-start' }}>
                      {canReact && (
                        <div style={{ display: 'flex', gap: 7 }}>
                          {EMOJIS.map((em) => (
                            <span key={em} onClick={(e) => { e.stopPropagation(); react(l.id!, em); }} style={{ cursor: 'pointer', fontSize: 21, lineHeight: 1 }}>{em}</span>
                          ))}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 14, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
                        <span onClick={(e) => { e.stopPropagation(); doReply(l); }} style={{ cursor: 'pointer', color: '#128c7e' }}>{t('ccReplyBtn')}</span>
                        {l.mine && canReact && <span onClick={(e) => { e.stopPropagation(); del(l.id!); }} style={{ cursor: 'pointer', color: '#d3396d' }}>{t('ccDeleteBtn')}</span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {!lines.length && <div style={{ textAlign: 'center', color: '#54656f', marginTop: 30 }}>{t('ccNoMsgs')}</div>}
          </div>

          {otherTyping && <div style={{ padding: '3px 16px', fontSize: 12.5, color: '#128c7e', fontStyle: 'italic' }}>{otherTyping} {t('ccIsTyping')}</div>}

          {replyTo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: '#e9edeb', borderTop: '1px solid #dfe5e2' }}>
              <div style={{ flex: 1, borderLeft: '3px solid #25d366', paddingLeft: 8, overflow: 'hidden' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#128c7e' }}>{t('ccReplyingTo')} {replyTo.name}</div>
                <div style={{ fontSize: 13, color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{replyTo.text}</div>
              </div>
              <span onClick={() => setReplyTo(null)} style={{ cursor: 'pointer', fontSize: 18, color: '#54656f', padding: '0 4px' }}>✕</span>
            </div>
          )}

          {recording ? (
            <div style={{ display: 'flex', gap: 10, padding: 10, background: '#f0f2f5', alignItems: 'center' }}>
              <span style={{ color: '#e11', fontWeight: 800, fontSize: 18 }}>●</span>
              <span style={{ flex: 1, color: '#54656f', fontSize: 15 }}>{t('ccRecording')} <b>{mmss}</b></span>
              <button onClick={() => stopRec(true)} style={{ background: '#fff', color: '#d3396d', border: '1px solid #f0c9d6', borderRadius: 20, padding: '8px 14px', fontWeight: 700, cursor: 'pointer' }}>{t('ccCancelRec')}</button>
              <button onClick={() => stopRec(false)} style={circle} aria-label="Send voice">➤</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, padding: 10, background: '#f0f2f5', alignItems: 'center' }}>
              <label title={t('ccAttach')} style={{ fontSize: 24, cursor: sendingMedia ? 'default' : 'pointer', flexShrink: 0, opacity: sendingMedia ? 0.5 : 1, lineHeight: 1 }}>
                {sendingMedia ? '⏳' : '📎'}
                <input type="file" hidden accept="*/*" disabled={sendingMedia}
                  onChange={(e) => { const f = e.target.files?.[0]; e.currentTarget.value = ''; if (f) sendFile(f); }} />
              </label>
              <input style={{ ...input, borderRadius: 22, background: '#fff' }} value={draft}
                onChange={(e) => { setDraft(e.target.value); typingApi.current?.notify(); }}
                placeholder={t('ccTypeMsg')}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } }} />
              {draft.trim()
                ? <button style={circle} onClick={send} aria-label="Send">➤</button>
                : <button style={circle} onClick={startRec} aria-label="Record voice" title={t('ccHoldRecord')}>🎤</button>}
            </div>
          )}
          {err && <div style={{ color: '#d3396d', padding: '4px 12px', fontSize: 13 }}>{err}</div>}
        </div>
      )}

      {(call.state !== 'idle' || call.ended) && (
        <CallOverlay call={call} otherName={room?.otherName || ''} t={t} />
      )}
    </div>
  );
}
