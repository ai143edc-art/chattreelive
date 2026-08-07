import { useMemo, useState } from 'react';
import * as P from '../lib/parser';
import type { Message } from '../lib/parser';
import { useLang } from '../lib/i18n';
import { useModal, dialogProps } from '../lib/useModal';

interface Item { url: string; kind: 'img' | 'video'; name: string }

interface Props {
  open: boolean;
  onClose: () => void;
  messages: Message[];
  mediaMap: Record<string, string>;
  onOpen: (url: string, kind: 'img' | 'video') => void;
}

export default function GalleryModal({ open, onClose, messages, mediaMap, onOpen }: Props) {
  useModal(open, onClose);
  const { t } = useLang();
  const [tab, setTab] = useState<'all' | 'img' | 'video'>('all');

  const items = useMemo<Item[]>(() => {
    if (!open) return [];
    const out: Item[] = [];
    const seen = new Set<string>();
    for (const m of messages) {
      if (m.call) continue;
      const att = P.findAttachment(m.text);
      if (!att) continue;
      const fkey = att.split('/').pop()!.toLowerCase();
      const url = mediaMap[fkey];
      if (!url || seen.has(fkey)) continue;
      const ext = (fkey.match(/\.([a-z0-9]+)$/) || [])[1] || '';
      if (/^(jpe?g|png|gif|webp|bmp|heic)$/.test(ext)) { out.push({ url, kind: 'img', name: att }); seen.add(fkey); }
      else if (/^(mp4|3gp|mov|mkv|webm|avi)$/.test(ext)) { out.push({ url, kind: 'video', name: att }); seen.add(fkey); }
    }
    return out;
  }, [open, messages, mediaMap]);

  const photos = items.filter((i) => i.kind === 'img').length;
  const videos = items.length - photos;
  const shown = items.filter((i) => tab === 'all' || i.kind === tab);

  return (
    <div className={'gal' + (open ? ' show' : '')} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="gal-box" {...dialogProps} aria-label="Media gallery">
        <span className="x" onClick={onClose}>&times;</span>
        <h3>{t('gTitle')}</h3>
        <div className="gal-tabs">
          <button className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>{t('gAll')} ({items.length})</button>
          <button className={tab === 'img' ? 'on' : ''} onClick={() => setTab('img')}>{t('gPhotos')} ({photos})</button>
          <button className={tab === 'video' ? 'on' : ''} onClick={() => setTab('video')}>{t('gVideos')} ({videos})</button>
        </div>
        {shown.length === 0 ? (
          <p className="gal-empty">{t('gEmpty')}</p>
        ) : (
          <div className="gal-grid">
            {shown.map((it, i) => (
              <div className="gal-cell" key={it.name + i} onClick={() => onOpen(it.url, it.kind)}>
                {it.kind === 'img'
                  ? <img src={it.url} loading="lazy" alt="" />
                  : <><video src={it.url} preload="metadata" muted /><span className="gal-play">▶</span></>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
