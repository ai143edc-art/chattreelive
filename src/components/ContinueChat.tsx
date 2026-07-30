import { useEffect, useMemo, useRef, useState } from 'react';
import type { Message } from '../lib/parser';
import { createRoom, joinRoom, postMessage, subscribeRoom, type RoomMessage, type Side } from '../lib/rooms';

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
interface Line { name: string; text: string; time?: string; mine: boolean }

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
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (phase !== 'chat' || !room) return;
    const unsub = subscribeRoom(room.id, (m) =>
      setLive((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m])));
    return unsub;
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
      setRoom({ id: joinId, pin: joinPin.trim(), side: 'guest', myName: info.guestName, otherName: info.creatorName, history: info.history });
      setPhase('chat');
    } catch (e) { setErr((e as Error).message || String(e)); } finally { setBusy(false); }
  }

  async function send() {
    if (!room || !draft.trim()) return;
    const body = draft.trim(); setDraft('');
    try { await postMessage(room.id, room.pin, room.side, room.myName, body); }
    catch (e) { setErr((e as Error).message || String(e)); setDraft(body); }
  }

  const shareLink = room ? `${location.origin}/?room=${room.id}` : '';
  function copyLink() { navigator.clipboard?.writeText(`${shareLink}\nPIN: ${room?.pin}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }); }

  const lines: Line[] = room ? [
    ...room.history.filter((m) => !m.system && m.sender).map((m): Line => ({ name: m.sender!, text: m.text, time: m.time, mine: m.sender === room.myName })),
    ...live.map((m): Line => ({ name: m.senderName, text: m.body, mine: m.sender === room.side })),
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
          <div ref={bodyRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {lines.map((l, i) => (
              <div key={i} style={{ alignSelf: l.mine ? 'flex-end' : 'flex-start', maxWidth: '78%' }}>
                <div style={{ background: l.mine ? '#d9fdd3' : '#fff', borderRadius: 10, padding: '7px 11px', boxShadow: '0 1px 1px rgba(0,0,0,.08)', fontSize: 15, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {!l.mine && <div style={{ fontSize: 12, fontWeight: 700, color: '#128c7e' }}>{l.name}</div>}
                  {l.text}
                </div>
              </div>
            ))}
            {!lines.length && <div style={{ textAlign: 'center', color: '#54656f', marginTop: 30 }}>No messages yet — say hi 👋</div>}
          </div>
          <div style={{ display: 'flex', gap: 8, padding: 10, background: '#f0f2f5' }}>
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
