import { useEffect, useMemo, useRef, useState } from 'react';
import type { Message } from '../lib/parser';
import {
  createRoom, joinRoom, postMessage, subscribeRoom, fetchRoomMessages, uploadRoomMedia,
  reactMessage, deleteMessage, subscribeTyping, roomSync, rememberRoom,
  type RoomMessage, type Reaction, type ReplyTo, type Side,
} from '../lib/rooms';

/**
 * "Continue Chat" — take an imported conversation and keep it going, live,
 * with the other person. Creator imports + sets a PIN → gets a link. The other
 * person opens the link, enters the PIN, and both chat in real time.
 * WhatsApp-style: reactions, reply, delete-for-everyone, typing, voice + any file.
 * NOTE: experiment — not end-to-end encrypted.
 */
interface Props {
  mode: 'create' | 'join';
  importedMessages?: Message[];
  importedSenders?: string[];
  roomId?: string;
  autoPin?: string;            // when reopening from a saved room: skip the PIN prompt
  userEmail: string | null;
  onLogin: () => void;
  onHome: () => void;
}

interface ActiveRoom { id: string; pin: string; side: Side; myName: string; otherName: string; history: Message[] }
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
function previewOf(l: Line): string {
  if (l.deleted) return 'Deleted message';
  if (l.mediaType === 'image') return '📷 Photo';
  if (l.mediaType === 'video') return '🎥 Video';
  if (l.mediaType === 'audio') return '🎤 Voice message';
  if (l.mediaType === 'file') return `📄 ${l.mediaName || 'Document'}`;
  return l.text.length > 60 ? `${l.text.slice(0, 60)}…` : l.text;
}
function fmtLastSeen(iso: string): string {
  const d = new Date(iso); const now = new Date();
  if ((now.getTime() - d.getTime()) / 1000 < 60) return 'just now';
  const t = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `today at ${t}`;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return `yesterday at ${t}`;
  return `${d.toLocaleDateString([], { day: '2-digit', month: 'short' })} at ${t}`;
}

export default function ContinueChat({ mode, importedMessages, importedSenders, roomId: joinId, autoPin, userEmail, onLogin, onHome }: Props) {
  const senders = useMemo(() => importedSenders || [], [importedSenders]);
  const [phase, setPhase] = useState<'setup' | 'join' | 'chat'>(mode === 'create' ? 'setup' : 'join');
  const [room, setRoom] = useState<ActiveRoom | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const [myName, setMyName] = useState(senders[senders.length - 1] || 'You');
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
  const maxReadRef = useRef(0);              // highest message id I've seen
  const syncRef = useRef<() => void>(() => {});
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cancelRef = useRef(false);
  const recTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (phase !== 'chat' || !room) return;
    let alive = true;
    // upsert by id — inserts append, reaction/delete UPDATEs replace in place.
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

    // heartbeat: report my "seen now" + read mark, learn the other's → online/last-seen + blue ticks
    const sync = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      roomSync(room.id, room.pin, room.side, maxReadRef.current)
        .then((s) => { if (alive) { setOtherSeenAt(s.otherSeenAt); setOtherReadUpto(s.otherReadUpto); } })
        .catch(() => {});
    };
    syncRef.current = sync;
    sync();
    const hb = window.setInterval(sync, 10000);
    const onVis = () => { if (document.visibilityState === 'visible') sync(); };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      alive = false; unsub(); tp.unsub(); typingApi.current = null;
      window.clearTimeout(typingClear.current); window.clearInterval(hb);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [phase, room]);

  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [live, phase, otherTyping]);

  // when new messages arrive and I'm looking, advance my read mark + report it (drives the other's blue ticks)
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
    if (pin.trim().length < 4) { setErr('PIN must be at least 4 characters.'); return; }
    const otherName = senders.find((s) => s !== myName) || 'Guest';
    setBusy(true);
    try {
      const id = await createRoom(pin.trim(), myName, otherName, importedMessages || []);
      setRoom({ id, pin: pin.trim(), side: 'creator', myName, otherName, history: importedMessages || [] });
      rememberRoom({ id, pin: pin.trim(), myName, otherName, isCreator: true });
      setPhase('chat');
    } catch (e) { setErr((e as Error).message || String(e)); } finally { setBusy(false); }
  }

  async function doJoin(pinArg?: string) {
    setErr('');
    if (!joinId) return;
    const usePin = (pinArg ?? joinPin).trim();
    if (usePin.length < 4) { setErr('Enter the PIN.'); return; }
    setBusy(true);
    try {
      const info = await joinRoom(joinId, usePin);
      if (!info) { setErr('Wrong PIN, or this chat no longer exists.'); return; }
      const side: Side = info.isCreator ? 'creator' : 'guest';
      const myNm = info.isCreator ? info.creatorName : info.guestName;
      const otherNm = info.isCreator ? info.guestName : info.creatorName;
      setRoom({ id: joinId, pin: usePin, side, myName: myNm, otherName: otherNm, history: info.history });
      rememberRoom({ id: joinId, pin: usePin, myName: myNm, otherName: otherNm, isCreator: info.isCreator });
      setPhase('chat');
    } catch (e) { setErr((e as Error).message || String(e)); } finally { setBusy(false); }
  }

  // reopening from a saved room → auto-join with the stored PIN, no prompt
  useEffect(() => {
    if (mode === 'join' && autoPin && phase === 'join' && !room) doJoin(autoPin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function doReply(l: Line) { setReplyTo({ name: l.name, text: previewOf(l) }); setMenuFor(null); }

  // ---- voice message (record → send) ----
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
    } catch { setErr('Voice message ke liye mic ki permission do.'); }
  }
  function stopRec(cancel: boolean) {
    const mr = recRef.current;
    if (!mr) return;
    cancelRef.current = cancel;
    recRef.current = null; setRecording(false);
    try { mr.stop(); } catch { /* already stopped */ }
  }

  const shareLink = room ? `${location.origin}/?room=${room.id}` : '';
  function copyLink() { navigator.clipboard?.writeText(`${shareLink}\nPIN: ${room?.pin}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }); }

  const lines: Line[] = room ? [
    ...room.history.filter((m) => !m.system && m.sender).map((m): Line => ({ name: m.sender!, text: m.text, time: m.time, mine: m.sender === room.myName })),
    ...live.map((m): Line => ({
      id: m.id, name: m.senderName, text: m.body, time: fmtTime(m.createdAt), mine: m.sender === room.side,
      mediaUrl: m.mediaUrl, mediaType: m.mediaType, mediaName: m.mediaName, reactions: m.reactions,
      replyName: m.replyName, replyText: m.replyText, deleted: m.deleted,
    })),
  ] : [];

  const keyOf = (l: Line, i: number) => (l.id != null ? `m${l.id}` : `h${i}`);
  const mmss = `${Math.floor(recSecs / 60)}:${String(recSecs % 60).padStart(2, '0')}`;
  const otherOnline = !!otherSeenAt && Date.now() - new Date(otherSeenAt).getTime() < 35000;
  const statusText = otherTyping ? 'typing…' : otherOnline ? 'online' : otherSeenAt ? `last seen ${fmtLastSeen(otherSeenAt)}` : '';

  const wrap: React.CSSProperties = { maxWidth: 520, margin: '0 auto', padding: '20px 16px' };
  const input: React.CSSProperties = { width: '100%', padding: '12px 14px', border: '1px solid #d7ded9', borderRadius: 10, fontSize: 16, boxSizing: 'border-box' };
  const btn: React.CSSProperties = { background: 'linear-gradient(135deg,#25d366,#128c7e)', color: '#fff', border: 'none', borderRadius: 24, padding: '12px 22px', fontWeight: 700, fontSize: 16, cursor: 'pointer' };
  const circle: React.CSSProperties = { ...btn, borderRadius: '50%', width: 46, height: 46, padding: 0, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 };

  return (
    <div style={{ minHeight: '100vh', background: '#eae6df' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', background: '#fff', borderBottom: '1px solid #e6ebe9' }}>
        <span style={{ fontWeight: 800, color: '#128c7e', cursor: 'pointer' }} onClick={onHome}>💬 Chat Tree</span>
        {phase === 'chat' && room ? (
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.15 }}>
            <b style={{ fontSize: 14, color: '#111b21' }}>{room.otherName}</b>
            {statusText && <span style={{ fontSize: 12, color: otherOnline || otherTyping ? '#25904f' : '#54656f' }}>{statusText}</span>}
          </span>
        ) : <span style={{ fontSize: 13, color: '#54656f' }}>Continue chat · live</span>}
      </header>

      {phase === 'setup' && (
        <div style={wrap}>
          <h2 style={{ margin: '6px 0' }}>Continue this chat, live 🔗</h2>
          <p style={{ color: '#54656f', marginTop: 0 }}>You imported <b>{(importedMessages || []).length}</b> messages. Set a PIN and you'll get a link to share — the other person joins and you keep chatting in real time.</p>
          {!userEmail && (
            <div style={{ background: '#fff8e6', border: '1px solid #f2e2b6', borderRadius: 10, padding: 14, margin: '14px 0', color: '#6b5a2a' }}>
              Please <a role="button" style={{ color: '#128c7e', fontWeight: 700, cursor: 'pointer' }} onClick={onLogin}>log in</a> first — a room is saved to your account so you can come back to it.
            </div>
          )}
          <label style={{ fontWeight: 600, fontSize: 14 }}>Which name are you?</label>
          <select style={{ ...input, margin: '6px 0 16px' }} value={myName} onChange={(e) => setMyName(e.target.value)}>
            {(senders.length ? senders : ['You']).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <label style={{ fontWeight: 600, fontSize: 14 }}>Set a PIN (min 4) — share it with the other person</label>
          <input style={{ ...input, margin: '6px 0 16px' }} value={pin} onChange={(e) => setPin(e.target.value)} placeholder="e.g. 4821" inputMode="numeric" />
          <button style={{ ...btn, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={doCreate}>{busy ? 'Creating…' : 'Create link'}</button>
          {err && <div style={{ color: '#d3396d', marginTop: 12 }}>{err}</div>}
        </div>
      )}

      {phase === 'join' && (
        <div style={wrap}>
          <h2 style={{ margin: '6px 0' }}>Join the chat 🔗</h2>
          <p style={{ color: '#54656f', marginTop: 0 }}>Enter the PIN the other person shared with you.</p>
          <input style={{ ...input, margin: '10px 0 16px', letterSpacing: 3, textAlign: 'center', fontSize: 20 }} value={joinPin} onChange={(e) => setJoinPin(e.target.value)} placeholder="PIN" inputMode="numeric"
            onKeyDown={(e) => { if (e.key === 'Enter') doJoin(); }} />
          <button style={{ ...btn, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => doJoin()}>{busy ? 'Joining…' : 'Join chat'}</button>
          {err && <div style={{ color: '#d3396d', marginTop: 12 }}>{err}</div>}
        </div>
      )}

      {phase === 'chat' && room && (
        <div style={{ maxWidth: 520, margin: '0 auto', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 49px)' }}>
          {room.side === 'creator' && (
            <div style={{ background: '#d9fdd3', padding: '10px 14px', fontSize: 13.5, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span>🔗 Share to invite <b>{room.otherName}</b>:</span>
              <code style={{ background: '#fff', padding: '2px 6px', borderRadius: 6, wordBreak: 'break-all' }}>{shareLink}</code>
              <span>PIN <b>{room.pin}</b></span>
              <button style={{ ...btn, padding: '5px 12px', fontSize: 13, borderRadius: 16 }} onClick={copyLink}>{copied ? 'Copied ✓' : 'Copy'}</button>
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
                      <span style={{ fontStyle: 'italic', color: '#8696a0' }}>🚫 This message was deleted</span>
                    ) : (
                      <>
                        {l.mediaUrl && l.mediaType === 'image' && <img src={l.mediaUrl} alt="" style={{ maxWidth: '100%', borderRadius: 8, display: 'block', marginBottom: l.text ? 4 : 0 }} />}
                        {l.mediaUrl && l.mediaType === 'video' && <video src={l.mediaUrl} controls style={{ maxWidth: '100%', borderRadius: 8, display: 'block', marginBottom: l.text ? 4 : 0 }} />}
                        {l.mediaUrl && l.mediaType === 'audio' && <audio src={l.mediaUrl} controls style={{ maxWidth: 220, display: 'block', marginBottom: l.text ? 4 : 0 }} />}
                        {l.mediaUrl && l.mediaType === 'file' && (
                          <a href={l.mediaUrl} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0a6b5b', fontWeight: 600, textDecoration: 'none', background: '#f5f6f6', borderRadius: 8, padding: '8px 10px', marginBottom: l.text ? 4 : 0 }}>
                            <span style={{ fontSize: 22 }}>📄</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{l.mediaName || 'Document'}</span>
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
                        <span onClick={(e) => { e.stopPropagation(); doReply(l); }} style={{ cursor: 'pointer', color: '#128c7e' }}>↩ Reply</span>
                        {l.mine && canReact && <span onClick={(e) => { e.stopPropagation(); del(l.id!); }} style={{ cursor: 'pointer', color: '#d3396d' }}>🗑 Delete</span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {!lines.length && <div style={{ textAlign: 'center', color: '#54656f', marginTop: 30 }}>No messages yet — say hi 👋</div>}
          </div>

          {otherTyping && <div style={{ padding: '3px 16px', fontSize: 12.5, color: '#128c7e', fontStyle: 'italic' }}>{otherTyping} is typing…</div>}

          {replyTo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: '#e9edeb', borderTop: '1px solid #dfe5e2' }}>
              <div style={{ flex: 1, borderLeft: '3px solid #25d366', paddingLeft: 8, overflow: 'hidden' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#128c7e' }}>Replying to {replyTo.name}</div>
                <div style={{ fontSize: 13, color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{replyTo.text}</div>
              </div>
              <span onClick={() => setReplyTo(null)} style={{ cursor: 'pointer', fontSize: 18, color: '#54656f', padding: '0 4px' }}>✕</span>
            </div>
          )}

          {recording ? (
            <div style={{ display: 'flex', gap: 10, padding: 10, background: '#f0f2f5', alignItems: 'center' }}>
              <span style={{ color: '#e11', fontWeight: 800, fontSize: 18 }}>●</span>
              <span style={{ flex: 1, color: '#54656f', fontSize: 15 }}>Recording voice message… <b>{mmss}</b></span>
              <button onClick={() => stopRec(true)} style={{ background: '#fff', color: '#d3396d', border: '1px solid #f0c9d6', borderRadius: 20, padding: '8px 14px', fontWeight: 700, cursor: 'pointer' }}>✖ Cancel</button>
              <button onClick={() => stopRec(false)} style={circle} aria-label="Send voice">➤</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, padding: 10, background: '#f0f2f5', alignItems: 'center' }}>
              <label title="Attach photo, video or any file" style={{ fontSize: 24, cursor: sendingMedia ? 'default' : 'pointer', flexShrink: 0, opacity: sendingMedia ? 0.5 : 1, lineHeight: 1 }}>
                {sendingMedia ? '⏳' : '📎'}
                <input type="file" hidden accept="*/*" disabled={sendingMedia}
                  onChange={(e) => { const f = e.target.files?.[0]; e.currentTarget.value = ''; if (f) sendFile(f); }} />
              </label>
              <input style={{ ...input, borderRadius: 22, background: '#fff' }} value={draft}
                onChange={(e) => { setDraft(e.target.value); typingApi.current?.notify(); }}
                placeholder="Type a message…"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } }} />
              {draft.trim()
                ? <button style={circle} onClick={send} aria-label="Send">➤</button>
                : <button style={circle} onClick={startRec} aria-label="Record voice" title="Hold to record — tap to start">🎤</button>}
            </div>
          )}
          {err && <div style={{ color: '#d3396d', padding: '4px 12px', fontSize: 13 }}>{err}</div>}
        </div>
      )}
    </div>
  );
}
