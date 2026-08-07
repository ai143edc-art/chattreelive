import { useLang } from '../lib/i18n';

export default function LangToggle({ className = '' }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <span className={'lang-toggle ' + className} role="group" aria-label="Language">
      <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')} aria-pressed={lang === 'en'}>EN</button>
      <button className={lang === 'hi' ? 'on' : ''} onClick={() => setLang('hi')} aria-pressed={lang === 'hi'}>हिं</button>
    </span>
  );
}
