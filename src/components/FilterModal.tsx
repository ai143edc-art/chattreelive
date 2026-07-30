import * as P from '../lib/parser';
import type { DateOrder } from '../lib/parser';
import { useLang } from '../lib/i18n';
import { useModal, dialogProps } from '../lib/useModal';

export interface ChatFilter { sender: string; from: string; to: string; mediaOnly: boolean }
export const EMPTY_FILTER: ChatFilter = { sender: '', from: '', to: '', mediaOnly: false };

interface Props {
  open: boolean;
  onClose: () => void;
  senders: string[];
  dates: string[];            // unique chat dates, in chronological order
  dateOrder: DateOrder;
  value: ChatFilter;
  onChange: (f: ChatFilter) => void;
  onClear: () => void;
  visibleCount: number;
  totalCount: number;
}

/** Filter the chat view by sender, date range, or media-only — without altering the data. */
export default function FilterModal({ open, onClose, senders, dates, dateOrder, value, onChange, onClear, visibleCount, totalCount }: Props) {
  useModal(open, onClose);
  const { t } = useLang();
  const set = (patch: Partial<ChatFilter>) => onChange({ ...value, ...patch });
  const label = (d: string) => P.formatDay(d, dateOrder);

  return (
    <div className={'hist' + (open ? ' show' : '')} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="hist-box flt-box" {...dialogProps} aria-label="Filter messages">
        <span className="x" onClick={onClose}>&times;</span>
        <h3>{t('fTitle')}</h3>

        <label className="flt-row">
          <span className="flt-lbl">{t('fSender')}</span>
          <select value={value.sender} onChange={(e) => set({ sender: e.target.value })}>
            <option value="">{t('fEveryone')}</option>
            {senders.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>

        <label className="flt-row">
          <span className="flt-lbl">{t('fFrom')}</span>
          <select value={value.from} onChange={(e) => set({ from: e.target.value })}>
            <option value="">{t('fBeginning')}</option>
            {dates.map((d) => <option key={d} value={d}>{label(d)}</option>)}
          </select>
        </label>

        <label className="flt-row">
          <span className="flt-lbl">{t('fTo')}</span>
          <select value={value.to} onChange={(e) => set({ to: e.target.value })}>
            <option value="">{t('fEnd')}</option>
            {dates.map((d) => <option key={d} value={d}>{label(d)}</option>)}
          </select>
        </label>

        <label className="flt-check">
          <input type="checkbox" checked={value.mediaOnly} onChange={(e) => set({ mediaOnly: e.target.checked })} />
          <span>{t('fMediaOnly')}</span>
        </label>

        <div className="flt-count">{t('fShowing')} <b>{visibleCount.toLocaleString()}</b> {t('fOf')} {totalCount.toLocaleString()} {t('fMessages')}</div>

        <div className="flt-actions">
          <button className="flt-clear" onClick={onClear}>{t('fClear')}</button>
          <button className="flt-done" onClick={onClose}>{t('fDone')}</button>
        </div>
      </div>
    </div>
  );
}
