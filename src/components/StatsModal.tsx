import type { Stats } from '../lib/stats';
import type { DateOrder } from '../lib/parser';
import { formatDay } from '../lib/parser';
import { useLang } from '../lib/i18n';
import { useModal, dialogProps } from '../lib/useModal';

interface Props {
  open: boolean;
  onClose: () => void;
  stats: Stats | null;
  dateOrder: DateOrder;
  title: string;
}

export default function StatsModal({ open, onClose, stats, dateOrder, title }: Props) {
  useModal(open, onClose);
  const { t } = useLang();
  return (
    <div className={'hist' + (open ? ' show' : '')} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="hist-box" {...dialogProps} aria-label="Chat statistics">
        <span className="x" onClick={onClose}>&times;</span>
        <h3>📊 {title} · {t('sStats')}</h3>
        {!stats ? <p className="hist-sub">{t('sNoData')}</p> : (
          <>
            <div className="stat-grid">
              <div className="stat-card"><div className="num">{stats.total.toLocaleString()}</div><div className="lbl">{t('sMessages')}</div></div>
              <div className="stat-card"><div className="num">{stats.mediaCount.toLocaleString()}</div><div className="lbl">{t('sMedia')}</div></div>
              <div className="stat-card"><div className="num">{stats.wordCount.toLocaleString()}</div><div className="lbl">{t('sWords')}</div></div>
              <div className="stat-card"><div className="num">{stats.emojiCount.toLocaleString()}</div><div className="lbl">{t('sEmojis')}</div></div>
              <div className="stat-card"><div className="num">{stats.days}</div><div className="lbl">{t('sActiveDays')}</div></div>
              <div className="stat-card"><div className="num">{stats.avgPerDay}</div><div className="lbl">{t('sMsgsDay')}</div></div>
            </div>

            {stats.perSender.length > 0 && (
              <div className="stat-bars">
                <div className="stat-sec">{t('sWhoMost')}</div>
                {stats.perSender.slice(0, 8).map((s) => {
                  const top = stats.perSender[0].count || 1;
                  const pct = Math.max(4, Math.round((s.count / top) * 100));
                  return (
                    <div className="stat-bar-row" key={s.name}>
                      <div className="nm"><span>{s.name}</span><span>{s.count.toLocaleString()}</span></div>
                      <div className="stat-bar"><i style={{ width: pct + '%' }} /></div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="stat-foot">
              📅 {formatDay(stats.firstDate, dateOrder)} → {formatDay(stats.lastDate, dateOrder)}<br />
              {t('sBusiest')} {formatDay(stats.busiestDate, dateOrder)} ({stats.busiestCount.toLocaleString()} {t('sMessagesLc')})
            </div>
          </>
        )}
      </div>
    </div>
  );
}
