import { useEffect, useState } from 'react';
import { recentRooms, forgetRoom, listMyRooms, type StoredRoom, type MyRoom } from '../lib/rooms';

/**
 * "My continue-chats" — recover a live room even if the share link is lost.
 *  • On this device: remembered rooms (link + PIN saved locally) → one-tap reopen.
 *  • Saved to your account: rooms you created, recoverable from ANY device once
 *    logged in (link comes back from your account; you re-enter your PIN).
 */
interface Props {
  userEmail: string | null;
  onOpen: (roomId: string, pin?: string) => void;
  onBack: () => void;
  onLogin: () => void;
}

function ago(iso: string | number): string {
  const d = new Date(iso); const now = new Date();
  const s = (now.getTime() - d.getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (d.toDateString() === now.toDateString()) return `today ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  return d.toLocaleDateString([], { day: '2-digit', month: 'short' });
}

export default function MyRooms({ userEmail, onOpen, onBack, onLogin }: Props) {
  const [recent, setRecent] = useState<StoredRoom[]>([]);
  const [mine, setMine] = useState<MyRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => { setRecent(recentRooms()); }, []);
  useEffect(() => {
    if (!userEmail) { setMine([]); return; }
    setLoading(true);
    listMyRooms().then(setMine).catch(() => setMine([])).finally(() => setLoading(false));
  }, [userEmail]);

  // account rooms that aren't already saved on this device (those get shown in "recent")
  const recentIds = new Set(recent.map((r) => r.id));
  const accountOnly = mine.filter((m) => !recentIds.has(m.id));

  function copyLink(id: string, pin?: string) {
    const link = `${location.origin}/?room=${id}`;
    navigator.clipboard?.writeText(pin ? `${link}\nPIN: ${pin}` : link)
      .then(() => { setCopied(id); setTimeout(() => setCopied((c) => (c === id ? null : c)), 1600); });
  }
  function remove(id: string) { forgetRoom(id); setRecent(recentRooms()); }

  const wrap: React.CSSProperties = { maxWidth: 560, margin: '0 auto', padding: '18px 16px 40px' };
  const card: React.CSSProperties = { background: '#fff', border: '1px solid #e6ebe9', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 };
  const openBtn: React.CSSProperties = { background: 'linear-gradient(135deg,#25d366,#128c7e)', color: '#fff', border: 'none', borderRadius: 20, padding: '8px 16px', fontWeight: 700, fontSize: 14, cursor: 'pointer', flexShrink: 0 };
  const ghost: React.CSSProperties = { background: 'transparent', border: '1px solid #cfd8d4', borderRadius: 20, padding: '7px 12px', fontSize: 13, cursor: 'pointer', color: '#3a4a44', flexShrink: 0 };
  const avatar: React.CSSProperties = { width: 42, height: 42, borderRadius: '50%', flexShrink: 0, background: '#25d366', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18 };

  return (
    <div style={{ minHeight: '100vh', background: '#eae6df' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', background: '#fff', borderBottom: '1px solid #e6ebe9' }}>
        <span style={{ fontWeight: 800, color: '#128c7e', cursor: 'pointer' }} onClick={onBack}>‹ Chat Tree</span>
        <span style={{ fontSize: 13, color: '#54656f' }}>My continue-chats</span>
      </header>

      <div style={wrap}>
        <h2 style={{ margin: '4px 0 2px' }}>Your live chats 🔗</h2>
        <p style={{ color: '#54656f', marginTop: 2 }}>Lost the link? Reopen a chat from here.</p>

        {/* On this device */}
        <h3 style={{ margin: '18px 0 8px', fontSize: 14, color: '#54656f', textTransform: 'uppercase', letterSpacing: 0.5 }}>On this device</h3>
        {recent.length === 0 && <div style={{ color: '#8696a0', fontSize: 14, marginBottom: 8 }}>No chats saved on this device yet.</div>}
        {recent.map((r) => (
          <div key={r.id} style={card}>
            <span style={avatar}>{(r.otherName || '?').charAt(0).toUpperCase()}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.otherName || 'Chat'}</div>
              <div style={{ fontSize: 12.5, color: '#8696a0' }}>{r.isCreator ? 'You started this' : 'You joined this'} · {ago(r.at)}</div>
            </div>
            <button style={ghost} onClick={() => copyLink(r.id, r.pin)}>{copied === r.id ? 'Copied ✓' : 'Copy'}</button>
            <button style={ghost} title="Remove from this device" onClick={() => remove(r.id)}>✕</button>
            <button style={openBtn} onClick={() => onOpen(r.id, r.pin)}>Open</button>
          </div>
        ))}

        {/* Saved to your account */}
        <h3 style={{ margin: '22px 0 8px', fontSize: 14, color: '#54656f', textTransform: 'uppercase', letterSpacing: 0.5 }}>Saved to your account</h3>
        {!userEmail ? (
          <div style={{ background: '#fff8e6', border: '1px solid #f2e2b6', borderRadius: 10, padding: 14, color: '#6b5a2a', fontSize: 14 }}>
            <a role="button" style={{ color: '#128c7e', fontWeight: 700, cursor: 'pointer' }} onClick={onLogin}>Log in</a> to see chats you created — these are saved to your account, so you can recover the link from <b>any</b> device (you'll just re-enter your PIN).
          </div>
        ) : loading ? (
          <div style={{ color: '#8696a0', fontSize: 14 }}>Loading…</div>
        ) : accountOnly.length === 0 ? (
          <div style={{ color: '#8696a0', fontSize: 14 }}>Nothing else — the chats you created show above.</div>
        ) : accountOnly.map((m) => (
          <div key={m.id} style={card}>
            <span style={avatar}>{(m.guestName || '?').charAt(0).toUpperCase()}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.guestName || 'Chat'}</div>
              <div style={{ fontSize: 12.5, color: '#8696a0' }}>You created this · active {ago(m.lastActiveAt)}</div>
            </div>
            <button style={ghost} onClick={() => copyLink(m.id)}>{copied === m.id ? 'Copied ✓' : 'Copy link'}</button>
            <button style={openBtn} onClick={() => onOpen(m.id)}>Open</button>
          </div>
        ))}

        <button style={{ ...ghost, marginTop: 20, padding: '10px 18px' }} onClick={onBack}>‹ Back</button>
      </div>
    </div>
  );
}
