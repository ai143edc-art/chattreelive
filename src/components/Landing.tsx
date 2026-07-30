import { useEffect, useRef } from 'react';
import { useLang } from '../lib/i18n';
import LangToggle from './LangToggle';
import { themeOf, weaveUrl, vignetteBg } from '../lib/bookThemes';

const BRAND = 'Chat Tree';

/** The hero book is stamped from the real Forest Cloth theme, not a lookalike. */
const CLOTH = themeOf('whatsapp');

/**
 * Line icons on a 24px grid. Emoji render differently on every OS and read as
 * clip-art at this size; these inherit currentColor and stay on-brand.
 */
const PATHS: Record<string, string> = {
  compose: 'M4 20h4l10-10a2.8 2.8 0 1 0-4-4L4 16v4Z M13 7l4 4',
  media: 'M3 5h18v14H3z M3 16l5-5 4 4 3-3 6 6 M8.5 9.5a1.2 1.2 0 1 0 0-.1',
  reply: 'M20 15a3 3 0 0 1-3 3H8l-4 3V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v9Z M9 10h7 M9 13.5h4',
  call: 'M6.5 3.5 9 8l-2 2a12 12 0 0 0 5 5l2-2 4.5 2.5-.5 4a2 2 0 0 1-2.2 1.8C8.6 20.6 3.4 15.4 2.7 8.2A2 2 0 0 1 4.5 6l2-2.5Z',
  ticks: 'm2 12.5 4 4 8-9 M10 16.5l1.6 1.6 8-9',
  device: 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z M10 5h4 M11 19h2',
  book: 'M4 4.5A2 2 0 0 1 6 3h13v15H6a2 2 0 0 0-2 2V4.5Z M19 18v3H6a2 2 0 0 1 0-4 M8 7.5h7',
  lock: 'M5 11h14v10H5z M8 11V7.5a4 4 0 0 1 8 0V11 M12 15v2.5',
};
function Icon({ name }: { name: string }) {
  return (
    <svg className="lp-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name].split(' M').map((seg, i) => <path key={i} d={(i ? 'M' : '') + seg} />)}
    </svg>
  );
}

export default function Landing({ onLaunch, onPrivacy, onTerms }: { onLaunch: () => void; onPrivacy: () => void; onTerms: () => void }) {
  const { t, lang } = useLang();
  const stage = useRef<HTMLDivElement>(null);
  const keyActivate = (fn: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); }
  };

  // The scene leans towards the pointer. Skipped entirely for anyone who has
  // asked their system for less motion, and on coarse pointers.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
      const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
      el.style.setProperty('--ry', `${(-dx * 9).toFixed(2)}deg`);
      el.style.setProperty('--rx', `${(dy * 7).toFixed(2)}deg`);
    };
    const reset = () => { el.style.setProperty('--ry', '0deg'); el.style.setProperty('--rx', '0deg'); };
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseleave', reset);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseleave', reset); };
  }, []);

  // Sections fade up as they arrive. The reveal starts them at opacity 0, so if
  // there is no observer to turn them on, show everything rather than nothing.
  useEffect(() => {
    const items = Array.from(document.querySelectorAll<HTMLElement>('.lp-reveal'));
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      items.forEach((n) => n.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -12% 0px' });
    // Anything already at or above the fold is shown outright. The observer only
    // fires on a crossing, so a restored scroll position or a deep link would
    // otherwise leave every section above it invisible for good.
    items.forEach((n) => {
      if (n.getBoundingClientRect().top < window.innerHeight) n.classList.add('in');
      else io.observe(n);
    });
    return () => io.disconnect();
  }, []);

  const FEATURES = [
    { icon: 'compose', title: t('f1t'), desc: t('f1d') },
    { icon: 'media', title: t('f2t'), desc: t('f2d') },
    { icon: 'reply', title: t('f3t'), desc: t('f3d') },
    { icon: 'call', title: t('f4t'), desc: t('f4d') },
    { icon: 'ticks', title: t('f5t'), desc: t('f5d') },
    { icon: 'device', title: t('f6t'), desc: t('f6d') },
    { icon: 'book', title: t('f7t'), desc: t('f7d') },
    { icon: 'lock', title: t('f8t'), desc: t('f8d') },
  ];
  const STEPS = [
    { n: '1', title: t('s1t'), desc: t('s1d') },
    { n: '2', title: t('s2t'), desc: t('s2d') },
    { n: '3', title: t('s3t'), desc: t('s3d') },
  ];
  const USES = [t('use1'), t('use2'), t('use3'), t('use4'), t('use5'), t('use6')];
  const FAQ = [
    { q: t('q1'), a: t('a1') }, { q: t('q2'), a: t('a2') },
    { q: t('q3'), a: t('a3') }, { q: t('q4'), a: t('a4') },
  ];

  return (
    <div className="lp">
      <header className="lp-nav">
        <span className="lp-logo">💬 {BRAND}</span>
        <span className="lp-nav-right">
          <LangToggle />
          <button className="lp-cta sm" onClick={onLaunch}>{t('navOpen')}</button>
        </span>
      </header>

      <section className="lp-hero">
        <div className="lp-hero-txt">
          <span className="lp-badge">{t('badge')}</span>
          <h1>{t('heroTitle')}</h1>
          <p className="lp-sub">{t('heroSub')}</p>
          <div className="lp-actions">
            <button className="lp-cta" onClick={onLaunch}>{t('ctaCreate')}</button>
            <button className="lp-cta ghost" onClick={onLaunch}>{t('ctaUpload')}</button>
          </div>
          <div className="lp-trust">{t('trust')}</div>
        </div>
        {/* The chat on the left, the book it becomes on the right — the whole pitch. */}
        <div className="lp-hero-art" aria-hidden="true">
          <div className="lp-scene">
            <div className="lp-stage" ref={stage}>
              <div className="lp-book">
                <span className="lp-bk-edge" />
                <span className="lp-bk-spine" style={{ background: `linear-gradient(90deg,${CLOTH.clothEdge},${CLOTH.clothEdge} 58%,rgba(0,0,0,.28) 92%,rgba(255,255,255,.10))` }} />
                <div className="lp-bk-face" style={{ background: CLOTH.cloth, color: CLOTH.foil }}>
                  <span className="lp-bk-weave" style={{ backgroundImage: weaveUrl(CLOTH) }} />
                  <span className="lp-bk-vig" style={{ background: vignetteBg(CLOTH) }} />
                  <span className="lp-bk-fr" style={{ borderColor: CLOTH.foil }} />
                  <div className="lp-bk-stamp">
                    <span className="lp-bk-rule" style={{ background: CLOTH.foil }} />
                    <span className="lp-bk-ttl">Priya &amp; Me</span>
                    <span className="lp-bk-sub">A conversation keepsake</span>
                    <span className="lp-bk-rule" style={{ background: CLOTH.foil }} />
                    <span className="lp-bk-yr">2024 — 2026</span>
                  </div>
                </div>
              </div>

              <div className="lp-phone">
                <div className="lp-ph-head"><span className="lp-ph-ava" />Priya <span className="lp-ph-st">online</span></div>
                <div className="lp-ph-body">
                  <div className="lp-b in">Happy birthday! 🎉</div>
                  <div className="lp-b out">Aww thank you! 😄</div>
                  <div className="lp-b in">Party tonight? 🥳</div>
                  <div className="lp-b out">Definitely 🔥 <span className="lp-tk">✓✓</span></div>
                </div>
              </div>
            </div>
            <span className="lp-scene-shadow" />
          </div>
        </div>
      </section>

      <section className="lp-sec">
        <h2>{t('featuresTitle')}</h2>
        <div className="lp-grid">
          {FEATURES.map((f) => (
            <div className="lp-card lp-reveal" key={f.title}>
              <span className="lp-ic-wrap"><Icon name={f.icon} /></span>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-sec lp-steps-sec">
        <h2>{t('stepsTitle')}</h2>
        <div className="lp-steps">
          {STEPS.map((s) => (
            <div className="lp-step lp-reveal" key={s.n}>
              <span className="lp-step-n">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* The photograph is cropped to the printed page: the facing collage page in
          the original render is not something the exporter actually produces. */}
      <section className="lp-sec lp-keep">
        <div className="lp-keep-art lp-reveal">
          <img src="/keepsake-book.webp" width={700} height={676}
            loading="lazy" decoding="async" alt={t('keepAlt')} />
        </div>
        <div className="lp-keep-txt lp-reveal">
          <h2>{t('keepTitle')}</h2>
          <p>{t('keepBody')}</p>
          <ul className="lp-keep-list">
            <li>{t('keepP1')}</li>
            <li>{t('keepP2')}</li>
            <li>{t('keepP3')}</li>
          </ul>
          <button className="lp-cta" onClick={onLaunch}>{t('ctaCreate')}</button>
        </div>
      </section>

      <section className="lp-sec">
        <h2>{t('usesTitle')}</h2>
        <div className="lp-uses">
          {USES.map((u) => <span className="lp-use lp-reveal" key={u}>{u}</span>)}
        </div>
      </section>

      <section className="lp-sec">
        <h2>{t('faqTitle')}</h2>
        <div className="lp-faq">
          {FAQ.map((f) => (
            <details className="lp-q lp-reveal" key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="lp-final">
        <h2>{t('finalTitle')}</h2>
        <button className="lp-cta" onClick={onLaunch}>{t('finalCta')}</button>
      </section>

      <footer className="lp-foot">
        <div>💬 {BRAND}</div>
        <p className="lp-disc">{t('footerDisc')}</p>
        {/* Real crawlable link to the static guides hub — internal linking + SEO.
            Points to the Hindi hub when the app is in Hindi, English otherwise;
            each hub then cross-links to the other via its EN/हिं toggle. */}
        <div className="lp-copy">
          <a className="lp-link" href={lang === 'hi' ? '/guides/hi/' : '/guides/'}>{t('guideLink')}</a>
        </div>
        <div className="lp-copy">
          © {new Date().getFullYear()} {BRAND}
          <span className="lp-sep"> · </span>
          <a className="lp-link" role="button" tabIndex={0} onClick={onPrivacy} onKeyDown={keyActivate(onPrivacy)}>{t('privacyLink')}</a>
          <span className="lp-sep"> · </span>
          <a className="lp-link" role="button" tabIndex={0} onClick={onTerms} onKeyDown={keyActivate(onTerms)}>{t('termsLink')}</a>
        </div>
      </footer>
    </div>
  );
}
