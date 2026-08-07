import { useEffect, useState } from 'react';
import { referralStats, type RefStat } from '../lib/referral';

export default function RefStats({ userEmail, onLogin, onBack }: { userEmail: string | null; onLogin: () => void; onBack: () => void }) {
  const [rows, setRows] = useState<RefStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!userEmail) return;
    setLoading(true); setErr('');
    referralStats().then(setRows).catch((e) => setErr((e as Error).message)).finally(() => setLoading(false));
  }, [userEmail]);

  const wrap: React.CSSProperties = { maxWidth: 640, margin: '0 auto', padding: '22px 16px 50px' };
  const th: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', fontSize: 13, color: '#54656f', borderBottom: '1px solid #e6ebe9' };
  const td: React.CSSProperties = { padding: '10px 12px', fontSize: 14, borderBottom: '1px solid #f0f2f0' };

  const totV = rows.reduce((s, r) => s + r.visits, 0);
  const totA = rows.reduce((s, r) => s + r.activations, 0);

  return (
    <div style={{ minHeight: '100dvh', background: '#eae6df' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', background: '#fff', borderBottom: '1px solid #e6ebe9' }}>
        <span style={{ fontWeight: 800, color: '#128c7e', cursor: 'pointer' }} onClick={onBack}>‹ Chat Tree</span>
        <span style={{ fontSize: 13, color: '#54656f' }}>Promoter stats</span>
      </header>

      <div style={wrap}>
        <h2 style={{ margin: '4px 0 2px' }}>Promoter referrals 📊</h2>
        <p style={{ color: '#54656f', marginTop: 2, fontSize: 14 }}>
          Share links like <code style={{ background: '#fff', padding: '1px 6px', borderRadius: 5 }}>chattreeapp.fun/?ref=name</code> — each promoter's visits &amp; how many actually used the app show here.
        </p>

        {!userEmail ? (
          <div style={{ background: '#fff8e6', border: '1px solid #f2e2b6', borderRadius: 10, padding: 16, color: '#6b5a2a', fontSize: 14, marginTop: 14 }}>
            <a role="button" style={{ color: '#128c7e', fontWeight: 700, cursor: 'pointer' }} onClick={onLogin}>Log in</a> as the owner to see the numbers.
          </div>
        ) : loading ? (
          <div style={{ color: '#8696a0', marginTop: 16 }}>Loading…</div>
        ) : err ? (
          <div style={{ color: '#d3396d', marginTop: 16 }}>{err}</div>
        ) : rows.length === 0 ? (
          <div style={{ color: '#8696a0', marginTop: 16, fontSize: 14 }}>No referral visits yet — hand out some <b>?ref=</b> links first. (If you're logged in but see nothing, this account isn't the owner.)</div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e6ebe9', borderRadius: 12, marginTop: 16, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Promoter</th>
                  <th style={{ ...th, textAlign: 'right' }}>Visits</th>
                  <th style={{ ...th, textAlign: 'right' }}>Used it</th>
                  <th style={{ ...th, textAlign: 'right' }}>Conv.</th>
                  <th style={{ ...th, textAlign: 'right' }}>Last</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.ref}>
                    <td style={{ ...td, fontWeight: 700 }}>{r.ref}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{r.visits}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{r.activations}</td>
                    <td style={{ ...td, textAlign: 'right', color: '#0a8f68' }}>{r.visits ? Math.round((r.activations / r.visits) * 100) : 0}%</td>
                    <td style={{ ...td, textAlign: 'right', color: '#8696a0', fontSize: 12.5 }}>{new Date(r.last_at).toLocaleDateString([], { day: '2-digit', month: 'short' })}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ ...td, fontWeight: 800, borderBottom: 'none' }}>Total</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 800, borderBottom: 'none' }}>{totV}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 800, borderBottom: 'none' }}>{totA}</td>
                  <td style={{ ...td, textAlign: 'right', borderBottom: 'none' }} colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <button style={{ marginTop: 22, border: '1px solid #cfd8d4', background: '#f6f8f7', borderRadius: 16, padding: '10px 18px', fontSize: 14, cursor: 'pointer' }} onClick={onBack}>‹ Back</button>
      </div>
    </div>
  );
}
