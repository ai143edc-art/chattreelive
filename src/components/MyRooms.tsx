import { useEffect, useState } from 'react';
import {
  recentRooms, forgetRoom, listMyRooms, deleteRoom, allRoomMeta, setRoomMeta,
  type StoredRoom, type MyRoom, type RoomMeta,
} from '../lib/rooms';
import { confirmDialog, alertDialog } from '../lib/dialog';
import { useLang } from '../lib/i18n';
import type { TKey } from '../lib/i18n';

/**
 * "My continue-chats" — recover a live room even if the share link is lost, and
 * manage it: 🏷️ label, 🔗 copy link, ✏️ rename, 🗑️ delete.
 *  • On this device: rooms remembered in localStorage (link + PIN) → one-tap reopen.
 *  • Saved to your account: rooms you created, recoverable from ANY device once
 *    logged in (link comes back from your account; you re-enter your PIN).
 */
interface Props {
  userEmail: string | null;
  onOpen: (roomId: string, pin?: string) => void;
  onBack: () => void;
  onLogin: () => void;
}

// `k` is a STABLE key (stored as the room's tag — never translate it); `tk` is
// the i18n key for the label we actually show, so switching language is display-only.
const CATS: { k: string; e: string; tk: TKey }[] = [
  { k: 'Family', e: '👨‍👩‍👧', tk: 'mrCatFamily' }, { k: 'Friends', e: '🧑‍🤝‍🧑', tk: 'mrCatFriends' }, { k: 'Love', e: '❤️', tk: 'mrCatLove' },
  { k: 'Work', e: '💼', tk: 'mrCatWork' }, { k: 'Study', e: '📚', tk: 'mrCatStudy' }, { k: 'Other', e: '🏷️', tk: 'mrCatOther' },
];

function ago(iso: string | number, t: (k: TKey) => string): string {
  const d = new Date(iso); const now = new Date();
  const s = (now.getTime() - d.getTime()) / 1000;
  if (s < 60) return t('ccJustNow');
  if (s < 3600) return `${Math.floor(s / 60)}${t('mrMinAgo')}`;
  if (d.toDateString() === now.toDateString()) return `${t('ccToday')} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  return d.toLocaleDateString([], { day: '2-digit', month: 'short' });
}

export default function MyRooms({ userEmail, onOpen, onBack, onLogin }: Props) {
  const { t } = useLang();
  const [recent, setRecent] = useState<StoredRoom[]>([]);
  const [mine, setMine] = useState<MyRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [meta, setMeta] = useState<Record<string, RoomMeta>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const [tagging, setTagging] = useState<string | null>(null);

  useEffect(() => { setRecent(recentRooms()); setMeta(allRoomMeta()); }, []);
  useEffect(() => {
    if (!userEmail) { setMine([]); return; }
    setLoading(true);
    listMyRooms().then(setMine).catch(() => setMine([])).finally(() => setLoading(false));
  }, [userEmail]);

  const recentIds = new Set(recent.map((r) => r.id));
  const accountOnly = mine.filter((m) => !recentIds.has(m.id));

  function updateMeta(id: string, patch: RoomMeta) { setRoomMeta(id, patch); setMeta(allRoomMeta()); }
  function copyLink(id: string, pin?: string) {
    const link = `${location.origin}/?room=${id}`;
    navigator.clipboard?.writeText(pin ? `${link}\nPIN: ${pin}` : link)
      .then(() => { setCopied(id); setTimeout(() => setCopied((c) => (c === id ? null : c)), 1600); });
  }
  function startRename(id: string, current: string) { setTagging(null); setEditing(id); setEditVal(current); }
  function saveRename(id: string) { updateMeta(id, { title: editVal.trim() || undefined }); setEditing(null); }
  async function del(id: string, owned: boolean) {
    const msg = owned ? t('mrDelOwnedMsg') : t('mrDelGuestMsg');
    if (!(await confirmDialog({ title: owned ? t('mrDelOwnedTitle') : t('mrDelGuestTitle'), message: msg, confirmLabel: owned ? t('mrDeleteT') : t('mrRemove'), danger: owned }))) return;
    try { if (owned) await deleteRoom(id); }
    catch (e) { alertDialog({ title: t('mrError'), message: `${t('mrCantDelete')} ${(e as Error).message}` }); return; }
    forgetRoom(id); setRecent(recentRooms());
    setMine((m) => m.filter((x) => x.id !== id));
  }

  const wrap: React.CSSProperties = { maxWidth: 560, margin: '0 auto', padding: '18px 16px 40px' };
  const cardOuter: React.CSSProperties = { background: '#fff', border: '1px solid #e6ebe9', borderRadius: 12, padding: '10px 12px', marginBottom: 10 };
  const mainRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10 };
  const openBtn: React.CSSProperties = { background: 'linear-gradient(135deg,#25d366,#128c7e)', color: '#fff', border: 'none', borderRadius: 20, padding: '8px 15px', fontWeight: 700, fontSize: 14, cursor: 'pointer', flexShrink: 0 };
  const iconBtn: React.CSSProperties = { width: 32, height: 32, borderRadius: 9, border: '1px solid #dfe5e2', background: '#fff', cursor: 'pointer', fontSize: 15, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0 };
  const avatar: React.CSSProperties = { width: 42, height: 42, borderRadius: '50%', flexShrink: 0, background: '#25d366', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18 };
  const chip: React.CSSProperties = { border: '1px solid #cfd8d4', background: '#f6f8f7', borderRadius: 16, padding: '5px 11px', fontSize: 13, cursor: 'pointer' };

  function card(id: string, fallbackName: string, subtitle: string, owned: boolean, pin?: string) {
    const m = meta[id] || {};
    const title = m.title || fallbackName || t('mrChatFallback');
    const cat = CATS.find((c) => c.k === m.tag);
    return (
      <div key={id} style={cardOuter}>
        <div style={mainRow}>
          <span style={avatar}>{(title || '?').charAt(0).toUpperCase()}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            {editing === id ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input autoFocus value={editVal} onChange={(e) => setEditVal(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveRename(id); if (e.key === 'Escape') setEditing(null); }}
                  style={{ flex: 1, minWidth: 0, padding: '5px 8px', border: '1px solid #cfd8d4', borderRadius: 8, fontSize: 14 }} />
                <button style={{ ...iconBtn, color: '#128c7e' }} onClick={() => saveRename(id)}>✓</button>
                <button style={iconBtn} onClick={() => setEditing(null)}>✕</button>
              </div>
            ) : (
              <>
                <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {title}
                  {cat && <span style={{ marginLeft: 6, fontSize: 11.5, background: '#e7f6ee', color: '#0a6b5b', borderRadius: 10, padding: '1px 7px', fontWeight: 600 }}>{cat.e} {t(cat.tk)}</span>}
                </div>
                <div style={{ fontSize: 12.5, color: '#8696a0' }}>{subtitle}</div>
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
            <button style={iconBtn} title={t('mrLabel')} onClick={() => { setEditing(null); setTagging((prev) => (prev === id ? null : id)); }}>🏷️</button>
            <button style={iconBtn} title={t('mrCopyLinkT')} onClick={() => copyLink(id, pin)}>{copied === id ? '✓' : '🔗'}</button>
            <button style={iconBtn} title={t('mrRenameT')} onClick={() => startRename(id, title)}>✏️</button>
            <button style={{ ...iconBtn, color: '#d3396d' }} title={t('mrDeleteT')} onClick={() => del(id, owned)}>🗑️</button>
          </div>
          <button style={openBtn} onClick={() => onOpen(id, pin)}>{t('mrOpen')}</button>
        </div>
        {tagging === id && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 10, paddingTop: 10, borderTop: '1px solid #eef2f0' }}>
            {CATS.map((c) => (
              <button key={c.k} style={{ ...chip, ...(m.tag === c.k ? { background: '#25d366', color: '#fff', borderColor: '#25d366' } : {}) }}
                onClick={() => { updateMeta(id, { tag: c.k }); setTagging(null); }}>{c.e} {t(c.tk)}</button>
            ))}
            {m.tag && <button style={{ ...chip, color: '#d3396d' }} onClick={() => { updateMeta(id, { tag: undefined }); setTagging(null); }}>{t('mrClear')}</button>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#eae6df' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', background: '#fff', borderBottom: '1px solid #e6ebe9' }}>
        <span style={{ fontWeight: 800, color: '#128c7e', cursor: 'pointer' }} onClick={onBack}>‹ Chat Tree</span>
        <span style={{ fontSize: 13, color: '#54656f' }}>{t('mrHeaderTitle')}</span>
      </header>

      <div style={wrap}>
        <h2 style={{ margin: '4px 0 2px' }}>{t('mrTitle')}</h2>
        <p style={{ color: '#54656f', marginTop: 2 }}>{t('mrSub')}</p>

        <h3 style={{ margin: '18px 0 8px', fontSize: 14, color: '#54656f', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('mrOnDevice')}</h3>
        {recent.length === 0 && <div style={{ color: '#8696a0', fontSize: 14, marginBottom: 8 }}>{t('mrNoneDevice')}</div>}
        {recent.map((r) => card(r.id, r.otherName, `${r.isCreator ? t('mrYouStarted') : t('mrYouJoined')} · ${ago(r.at, t)}`, r.isCreator, r.pin))}

        <h3 style={{ margin: '22px 0 8px', fontSize: 14, color: '#54656f', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('mrSavedAccount')}</h3>
        {!userEmail ? (
          <div style={{ background: '#fff8e6', border: '1px solid #f2e2b6', borderRadius: 10, padding: 14, color: '#6b5a2a', fontSize: 14 }}>
            <a role="button" style={{ color: '#128c7e', fontWeight: 700, cursor: 'pointer' }} onClick={onLogin}>{t('logIn')}</a> {t('mrLoginBox')}
          </div>
        ) : loading ? (
          <div style={{ color: '#8696a0', fontSize: 14 }}>{t('mrLoading')}</div>
        ) : accountOnly.length === 0 ? (
          <div style={{ color: '#8696a0', fontSize: 14 }}>{t('mrNothingElse')}</div>
        ) : accountOnly.map((mr) => card(mr.id, mr.guestName, `${t('mrYouCreated')} · ${t('mrActive')} ${ago(mr.lastActiveAt, t)}`, true))}

        <button style={{ ...chip, marginTop: 20, padding: '10px 18px' }} onClick={onBack}>{t('mrBack')}</button>
      </div>
    </div>
  );
}
