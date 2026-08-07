import { useState } from 'react';

interface Opt { label: string; value: string; }
interface Props {
  value: string;
  options: Opt[];
  onChange: (v: string) => void;
  placeholder?: string;
}

export default function MiniSelect({ value, options, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const cur = options.find((o) => o.value === value);
  return (
    <div className="mini-sel">
      <button type="button" className="ms-btn" onClick={() => setOpen((v) => !v)}>
        <span className="ms-label">{cur ? cur.label : (placeholder ?? value)}</span>
        <span className="ms-arrow">▾</span>
      </button>
      {open && (
        <>
          <div className="ms-overlay" onClick={() => setOpen(false)} />
          <div className="ms-menu">
            {options.map((o) => (
              <div
                key={o.value + o.label}
                className={'ms-item' + (o.value === value ? ' sel' : '')}
                onClick={() => { onChange(o.value); setOpen(false); }}
              >
                {o.label}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
