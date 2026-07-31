import { useEffect, useMemo, useRef, useState } from 'react';
import type { Message } from '../lib/parser';
import { createRoom, joinRoom, postMessage, subscribeRoom, fetchRoomMessages, uploadRoomMedia, reactMessage, type RoomMessage, type Reaction, type Side } from '../lib/rooms';

/**
 * "Continue Chat" — take an imported conversation and keep it going, live,
 * with the other person. Creator imports + sets a PIN → gets a link. The other
 * person opens the link, enters the PIN, and both chat in real time.
 * Self-contained (its own small chat UI) so App needs almost no change.
 * NOTE: experiment — not end-to-end encrypted.
 */
interface Props {
  mode: 'create' | 'join';
  importedMessages?: Message[];   // create mode: the imported history
  importedSenders?: string[];     // create mode: participant names
  roomId?: string;                // join mode: the room from the link
  userEmail: string | null;
  onLogin: () => void;
  onHome: () => void;
}

interface ActiveRoom { id: string; pin: string; side: Side; myName: string; otherName: string; history: Message[] }
interface Line { id?: number; name: string; text: string; time?: string; mine: boolean; mediaUrl?: string | null; mediaType?: string | null; mediaName?: string | null; reactions?: Reaction[] }

// WhatsApp's reaction set.
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

export default function ContinueChat({ mode, importedMessages, importedSenders, roomId: joinId, userEmail, onLogin, onHome }: Props) {
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
  const [reactingTo, setReactingTo] = useState<number | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (phase !== 'chat' || !room) return;
    let alive = true;
    // merge upserts by id — new inserts append, reaction UPDATEs replace in place;
    // so saved history, live inserts and reaction changes never double up or go stale.
    const merge = (prev: RoomMessage[], m: RoomMessage) => {
      const i = prev.findIndex((x) => x.id === m.id);
      if (i === -1) return [...prev, m].sort((a, b) => (a.id || 0) - (b.id || 0));
      const copy = prev.slice(); copy[i] = m; return copy;
    };
    const unsub = subscribeRoom(room.id, (m) => setLive((prev) => merge(prev, m)));
    // load everything sent before now, so re-entering a room resumes the full chat
    fetchRoomMessages(room.id).then((past) => { if (alive) setLive((prev) => past.reduce(merge, prev)); }).catch(() => {});
    return () => { alive = false; unsub(); };
  }, [phase, room]);

  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [live, phase]);

  async function doCreate() {
    setErr('');
    if (!userEmail) { onLogin(); return; }
    if (pin.trim().length < 4) { setErr('PIN must be at least 4 characters.'); return; }
    const otherName = senders.find((s) => s !== myName) || 'Guest';
    setBusy(true);
    try {
      const id = await createRoom(pin.trim(), myName, otherName, importedMessages || []);
      setRoom({ id, pin: pin.trim(), side: 'creator', myName, otherName, history: importedMessages || [] });
      setPhase('chat');
    } catch (e) { setErr((e as Error).message || String(e)); } finally { setBusy(false); }
  }

  async function doJoin() {
    setErr('');
    if (!joinId) return;
    if (joinPin.trim().length < 4) { setErr('Enter the PIN.'); return; }
    setBusy(true);
    try {
      const info = await joinRoom(joinId, joinPin.trim());
      if (!info) { setErr('Wrong PIN, or this chat no longer exists.'); return; }
      // If the room's owner comes back, they resume as the creator (their own name).
      const side: Side = info.isCreator ? 'creator' : 'guest';
      setRoom({
        id: joinId, pin: joinPin.trim(), side,
        myName: info.isCreator ? info.creatorName : info.guestName,
        otherName: info.isCreator ? info.guestName : info.creatorName,
        history: info.history,
      });
      setPhase('chat');
    } catch (e) { setErr((e as Error).message || String(e)); } finally { setBusy(false); }
  }

  async function send() {
    if (!room || !draft.trim()) return;
    const body = draft.trim(); setDraft('');
    try { await postMessage(room.id, room.pin, room.side, room.myName, body); }
    catch (e) { setErr((e as Error).message || String(e)); setDraft(body); }
  }

  async function sendFile(file: File) {
    if (!room) return;
    setErr(''); setSendingMedia(true);
    try {
      const media = await uploadRoomMedia(room.id, file);
      await postMessage(room.id, room.pin, room.side, room.myName, '', media);
    } catch (e) { setErr((e as Error).message || String(e)); } finally { setSendingMedia(false); }
  }

  async function react(messageId: number, emoji: string) {
    if (!room) return;
    setReactingTo(null);
    try { await reactMessage(room.id, room.pin, messageId, room.myName, emoji); }
    catch (e) { setErr((e as Error).message || String(e)); }
  }

  const shareLink = room ? `${location.origin}/?room=${room.id}` : '';
  function copyLink() { navigator.clipboard?.writeText(`${shareLink}\nPIN: ${room?.pin}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }); }

  const lines: Line[] = room ? [
    ...room.history.filter((m) => !m.system && m.sender).map((m): Line => ({ name: m.sender!, text: m.text, time: m.time, mine: m.sender === room.myName })),
    ...live.map((m): Line => ({ id: m.id, name: m.senderName, text: m.body, time: fmtTime(m.createdAt), mine: m.sender === room.side, mediaUrl: m.mediaUrl, mediaType: m.mediaType, mediaName: m.mediaName, reactions: m.reactions })),
  ] : [];

  const wrap: React.CSSProperties = { maxWidth: 520, margin: '0 auto', padding: '20px 16px' };
  const input: React.CSSProperties = { width: '100%', padding: '12px 14px', border: '1px solid #d7ded9', borderRadius: 10, fontSize: 16, boxSizing: 'border-box' };
  const btn: React.CSSProperties = { background: 'linear-gradient(135deg,#25d366,#128c7e)', color: '#fff', border: 'none', borderRadius: 24, padding: '12px 22px', fontWeight: 700, fontSize: 16, cursor: 'pointer' };

  return (
    <div style={{ minHeight: '100vh', background: '#eae6df' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', background: '#fff', borderBottom: '1px solid #e6ebe9' }}>
        <span style={{ fontWeight: 800, color: '#128c7e', cursor: 'pointer' }} onClick={onHome}>💬 Chat Tree</span>
        <span style={{ fontSize: 13, color: '#54656f' }}>Continue chat · live</span>
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
          <button style={{ ...btn, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={doJoin}>{busy ? 'Joining…' : 'Join chat'}</button>
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
          <div ref={bodyRef} onClick={() => setReactingTo(null)} style={{ flex: 1, overflowY: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {lines.map((l, i) => {
              const rx = aggReactions(l.reactions);
              const canReact = typeof l.id === 'number';
              return (
                <div key={l.id ?? `h${i}`} style={{ alignSelf: l.mine ? 'flex-end' : 'flex-start', maxWidth: '78%', position: 'relative', marginBottom: rx.length ? 12 : 0 }}>
                  <div
                    onClick={(e) => { e.stopPropagation(); if (canReact) setReactingTo(reactingTo === l.id ? null : l.id!); }}
                    style={{ background: l.mine ? '#d9fdd3' : '#fff', borderRadius: 10, padding: '7px 11px', boxShadow: '0 1px 1px rgba(0,0,0,.08)', fontSize: 15, whiteSpace: 'pre-wrap', wordBreak: 'break-word', cursor: canReact ? 'pointer' : 'default' }}
                  >
                    {!l.mine && <div style={{ fontSize: 12, fontWeight: 700, color: '#128c7e' }}>{l.name}</div>}
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
                    {l.time && <span style={{ fontSize: 10.5, color: '#8696a0', float: 'right', marginLeft: 8, marginTop: 3, position: 'relative', top: 3 }}>{l.time}</span>}
                  </div>

                  {rx.length > 0 && (
                    <div style={{ position: 'absolute', bottom: -11, left: l.mine ? 'auto' : 8, right: l.mine ? 8 : 'auto', display: 'flex', gap: 2, background: '#fff', border: '1px solid #eceff1', borderRadius: 12, padding: '1px 6px', boxShadow: '0 1px 2px rgba(0,0,0,.14)', fontSize: 12.5, lineHeight: 1.5 }}>
                      {rx.map((r) => <span key={r.emoji}>{r.emoji}{r.count > 1 ? ` ${r.count}` : ''}</span>)}
                    </div>
                  )}

                  {reactingTo === l.id && canReact && (
                    <div style={{ position: 'absolute', top: -42, left: l.mine ? 'auto' : 0, right: l.mine ? 0 : 'auto', display: 'flex', gap: 4, background: '#fff', borderRadius: 22, padding: '5px 9px', boxShadow: '0 3px 12px rgba(0,0,0,.22)', zIndex: 5 }}>
                      {EMOJIS.map((em) => (
                        <span key={em} onClick={(e) => { e.stopPropagation(); react(l.id!, em); }} style={{ cursor: 'pointer', fontSize: 21, lineHeight: 1 }}>{em}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {!lines.length && <div style={{ textAlign: 'center', color: '#54656f', marginTop: 30 }}>No messages yet — say hi 👋</div>}
          </div>
          <div style={{ display: 'flex', gap: 8, padding: 10, background: '#f0f2f5', alignItems: 'center' }}>
            <label title="Attach photo, video or any file" style={{ fontSize: 24, cursor: sendingMedia ? 'default' : 'pointer', flexShrink: 0, opacity: sendingMedia ? 0.5 : 1, lineHeight: 1 }}>
              {sendingMedia ? '⏳' : '📎'}
              <input ref={fileRef} type="file" hidden accept="*/*" disabled={sendingMedia}
                onChange={(e) => { const f = e.target.files?.[0]; e.currentTarget.value = ''; if (f) sendFile(f); }} />
            </label>
            <input style={{ ...input, borderRadius: 22, background: '#fff' }} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type a message…"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } }} />
            <button style={{ ...btn, borderRadius: '50%', width: 46, height: 46, padding: 0, flexShrink: 0 }} onClick={send} aria-label="Send">➤</button>
          </div>
          {err && <div style={{ color: '#d3396d', padding: '4px 12px', fontSize: 13 }}>{err}</div>}
        </div>
      )}
    </div>
  );
}
