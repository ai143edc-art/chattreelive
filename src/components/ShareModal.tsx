import { useEffect, useRef, useState } from 'react';
import * as P from '../lib/parser';
import { shareChat } from '../lib/supabase';
import { useLang } from '../lib/i18n';
import type { TKey } from '../lib/i18n';
import { useModal, dialogProps } from '../lib/useModal';

interface Props {
  open: boolean;
  chatId: string;
  title: string;
  avatar?: string | null;
  onClose: () => void;
  toast: (msg: string, ms?: number) => void;
}

/** How long a share link stays alive. 0 = never expires. */
const TTLS: { seconds: number; label: TKey }[] = [
  { seconds: 0, label: 'shareTtlNever' },
  { seconds: 300, label: 'shareTtl5m' },
  { seconds: 3600, label: 'shareTtl1h' },
  { seconds: 18000, label: 'shareTtl5h' },
  { seconds: 86400, label: 'shareTtl24h' },
  { seconds: 604800, label: 'shareTtl7d' },
];

/** Share sheet for a saved chat: pick how long the link lives, then hand out a
 *  downloadable QR card with the chat's profile (avatar + name). */
export default function ShareModal({ open, chatId, title, avatar, onClose, toast }: Props) {
  const { t } = useLang();
  const [ttl, setTtl] = useState(0);
  const [url, setUrl] = useState('');
  const [creating, setCreating] = useState(false);
  const [qr, setQr] = useState('');
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const name = title || 'Chat';

  // A freshly opened sheet always starts at the default expiry.
  useEffect(() => { if (open) setTtl(0); }, [open, chatId]);

  // Create (or re-stamp) the link whenever the chosen expiry changes.
  useEffect(() => {
    if (!open || !chatId) { setUrl(''); return; }
    let alive = true;
    setCreating(true);
    shareChat(chatId, ttl)
      .then((r) => { if (alive) setUrl(r.url); })
      .catch((e) => { if (alive) toast('❌ ' + ((e as Error).message || e), 4000); })
      .finally(() => { if (alive) setCreating(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, chatId, ttl]);

  useEffect(() => {
    if (!url) { setQr(''); return; }
    let alive = true;
    // Tuned so phone cameras lock on instantly: a full 4-module quiet zone
    // (the QR spec's requirement), low EC so the modules stay large, near-black
    // on white for maximum contrast, and a 3x source so the 240px render is crisp.
    // Loaded on demand — the encoder only matters once someone opens Share.
    import('qrcode')
      .then(({ default: QRCode }) => QRCode.toDataURL(url, {
        width: 720, margin: 4, errorCorrectionLevel: 'L',
        color: { dark: '#111b21', light: '#ffffff' },
      }))
      .then((d) => { if (alive) setQr(d); })
      .catch(() => { if (alive) setQr(''); });
    return () => { alive = false; };
  }, [url]);

  async function copy() {
    if (!url) return;
    try { await navigator.clipboard.writeText(url); toast(t('shareCopied'), 2200); }
    catch { prompt(t('hSharePrompt'), url); }
  }

  async function download() {
    if (!cardRef.current) return;
    setBusy(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const c = await html2canvas(cardRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false });
      const a = document.createElement('a');
      a.href = c.toDataURL('image/png');
      a.download = `${name.replace(/[^a-z0-9._-]+/gi, '_')}-qr.png`;
      a.click();
      toast(t('shareDownloaded'), 2400);
    } catch (e) {
      toast('❌ ' + ((e as Error).message || e), 3500);
    } finally {
      setBusy(false);
    }
  }

  const ttlLabel = t((TTLS.find((x) => x.seconds === ttl) || TTLS[0]).label);
  const expiryLine = ttl === 0 ? t('shareNeverExpires') : `${t('shareExpiresIn')} ${ttlLabel}`;
  const locked = busy || creating;
  useModal(open, onClose, !locked);

  return (
    <div className={'hist' + (open ? ' show' : '')} onClick={(e) => { if (e.target === e.currentTarget && !locked) onClose(); }}>
      <div className="hist-box sh-box" {...dialogProps} aria-label="Share chat">
        <span className="x" onClick={() => !locked && onClose()}>&times;</span>
        <h3>🔗 {t('shareTitle')}</h3>

        <div className="sh-ttl-label">{t('shareExpiry')}</div>
        <div className="sh-ttl">
          {TTLS.map((o) => (
            <button key={o.seconds} className={'sh-ttl-btn' + (ttl === o.seconds ? ' on' : '')}
              disabled={locked} onClick={() => setTtl(o.seconds)}>{t(o.label)}</button>
          ))}
        </div>

        <div className="sh-card" ref={cardRef}>
          <div className="sh-brand">💬 Chat Tree</div>

          <div className="sh-who">
            {avatar
              ? <img className="sh-ava" src={avatar} alt="" crossOrigin="anonymous" />
              : <span className="sh-ava e" style={{ background: P.avatarColor(name) }}>{P.initial(name)}</span>}
            <div className="sh-nm">
              <b>{name}</b>
              <span>{t('shareReadOnly')}</span>
            </div>
          </div>

          <div className="sh-qr">
            {qr ? <img src={qr} alt="QR code" /> : <span className="spinner lg" />}
          </div>

          <div className="sh-scan">{t('shareScan')}</div>
          <div className={'sh-exp' + (ttl === 0 ? '' : ' timed')}>{expiryLine}</div>
          <div className="sh-link">{creating ? t('shareCreating') : url}</div>
        </div>

        <div className="sh-actions">
          <button className="sh-copy" onClick={copy} disabled={locked || !url}>⧉ {t('shareCopy')}</button>
          <button className="sh-dl" onClick={download} disabled={locked || !qr}>
            {busy
              ? <span className="btn-load"><span className="spinner btn" />{t('pleaseWait')}</span>
              : `⬇ ${t('shareDownload')}`}
          </button>
        </div>

        <p className="sh-note">{t('shareNote')}</p>
      </div>
    </div>
  );
}
