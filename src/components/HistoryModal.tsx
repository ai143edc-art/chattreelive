import { useEffect, useState } from 'react';
import { listChats, getChat, renameChat, deleteChat, updateCategory } from '../lib/supabase';
import type { ChatRow } from '../lib/supabase';
import { CATEGORY_PRESETS, catEmoji } from '../lib/categories';
import { useLang } from '../lib/i18n';
import ShareModal from './ShareModal';
import { useModal, dialogProps } from '../lib/useModal';

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenChat: (row: ChatRow) => void;
  toast: (msg: string, ms?: number) => void;
}

export default function HistoryModal({ open, onClose, onOpenChat, toast }: Props) {
  useModal(open, onClose);
  const { t } = useLang();
  const [rows, setRows] = useState<ChatRow[] | null>(null);
  const [err, setErr] = useState('');
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('');
  const [openingId, setOpeningId] = useState('');
  const [share, setShare] = useState<{ id: string; title: string; avatar?: string | null } | null>(null);

  useEffect(() => {
    if (!open) return;
    setRows(null); setErr('');
    listChats().then(setRows).catch((e) => setErr((e as Error).message || String(e)));
  }, [open]);

  async function refresh() { try { setRows(await listChats()); } catch { /* ignore */ } }

  async function openChat(id: string) {
    if (openingId) return;
    setOpeningId(id);
    toast(t('hLoadingChat'), 0);
    try { const row = await getChat(id); if (row) onOpenChat(row); else toast(t('hNotFound'), 2500); }
    catch (e) { toast('❌ ' + ((e as Error).message || e), 3500); }
    finally { setOpeningId(''); }
  }
  async function doRename(id: string, cur: string) {
    const name = prompt(t('hRenamePrompt'), cur || ''); if (name == null) return;
    const nm = name.trim(); if (!nm) return;
    try { await renameChat(id, nm); toast(t('hRenamed'), 1800); refresh(); }
    catch (e) { toast('❌ ' + ((e as Error).message || e), 3000); }
  }
  function doShare(r: ChatRow) {
    setShare({ id: r.id, title: r.contact_title || r.title || 'Chat', avatar: r.avatar });
  }
  async function doDelete(id: string, title: string) {
    if (!confirm(t('hDeleteConfirm').replace('{x}', title))) return;
    try { await deleteChat(id); toast(t('hDeleted'), 1800); refresh(); }
    catch (e) { toast('❌ ' + ((e as Error).message || e), 3000); }
  }
  async function doCategory(id: string, cur: string) {
    const c = prompt(t('hCatPrompt').replace('{x}', CATEGORY_PRESETS.join(', ')), cur || '');
    if (c === null) return;
    const cc = c.trim();
    try { await updateCategory(id, cc || null); toast(t('hCatUpdated'), 1600); refresh(); }
    catch (e) { toast('❌ ' + ((e as Error).message || e), 3000); }
  }

  const cats = Array.from(new Set((rows || []).map((r) => r.category).filter(Boolean))) as string[];

  return (
    <>
    <div className={'hist' + (open ? ' show' : '')} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="hist-box" {...dialogProps} aria-label="Saved chats">
        <span className="x" onClick={onClose}>&times;</span>
        <h3>{t('hTitle')}</h3>
        {err && <div className="hist-err">{err}</div>}
        {rows === null ? (
          <div className="load-block">
            <span className="spinner lg" />
            <span className="lb-text">{t('hLoading')}</span>
          </div>
        ) : (
          <>
          {rows.length > 4 && (
            <input className="hist-pass" style={{ marginBottom: 10 }} placeholder={t('hSearch')}
              value={query} onChange={(e) => setQuery(e.target.value)} />
          )}
          {cats.length > 0 && (
            <div className="hist-cats">
              <button className={'hc-chip' + (cat === '' ? ' on' : '')} onClick={() => setCat('')}>{t('hAll')}</button>
              {cats.map((c) => (
                <button key={c} className={'hc-chip' + (cat === c ? ' on' : '')} onClick={() => setCat((v) => (v === c ? '' : c))}>
                  {catEmoji(c)} {c}
                </button>
              ))}
            </div>
          )}
          <div className="hist-list">
            {rows.length === 0 && (
              <p className="hist-sub">{t('hEmpty')}</p>
            )}
            {rows
              .filter((r) => (r.contact_title || r.title || '').toLowerCase().includes(query.toLowerCase()))
              .filter((r) => !cat || r.category === cat)
              .map((r) => {
              const d = new Date(r.created_at || '');
              const ds = isNaN(+d) ? '' : d.toLocaleDateString();
              const title = r.contact_title || r.title || 'Chat';
              const info = [r.msg_count != null ? `${r.msg_count.toLocaleString()} ${t('hMsgs')}` : '', ds].filter(Boolean).join(' · ');
              return (
                <div className={'hist-item' + (openingId === r.id ? ' opening' : '')} key={r.id}>
                  <div className="hi-main" onClick={() => openChat(r.id)}>
                    <span className="hi-title">
                      {title}
                      {r.category && <span className="hi-cat">{catEmoji(r.category)} {r.category}</span>}
                    </span>
                    <span className="hi-date">{info}</span>
                  </div>
                  {openingId === r.id && <span className="spinner sm" style={{ marginRight: 8 }} />}
                  <div className="hi-actions">
                    <button className="hi-btn" title={t('hCategory')} onClick={() => doCategory(r.id, r.category || '')}>🏷️</button>
                    <button className="hi-btn" title={t('hShare')} onClick={() => doShare(r)}>🔗</button>
                    <button className="hi-btn hi-rename" title={t('hRename')} onClick={() => doRename(r.id, title)}>✏️</button>
                    <button className="hi-btn hi-del" title={t('hDelete')} onClick={() => doDelete(r.id, title)}>🗑️</button>
                  </div>
                </div>
              );
            })}
          </div>
          </>
        )}
      </div>
    </div>
    <ShareModal open={!!share} chatId={share?.id || ''} title={share?.title || ''} avatar={share?.avatar}
      onClose={() => setShare(null)} toast={toast} />
    </>
  );
}
