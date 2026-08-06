import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import type { Session } from '@supabase/supabase-js';
import * as P from './lib/parser';
import { MODELS } from './lib/models';
import type { PhoneModel } from './lib/models';
import { computeStats } from './lib/stats';
import Uploader from './components/Uploader';
import type { LoadedChat } from './components/Uploader';
import Toolbar from './components/Toolbar';
import PhoneViewer from './components/PhoneViewer';
import Lightbox from './components/Lightbox';
import HistoryModal from './components/HistoryModal';
import AuthModal from './components/AuthModal';
import ContinueChat from './components/ContinueChat';
import MyRooms from './components/MyRooms';
import { recentRooms } from './lib/rooms';
import { loadScreen, saveScreen, loadDraft, saveDraft } from './lib/session';
import { captureRef, markActivated } from './lib/referral';
import RefStats from './components/RefStats';
import { alertDialog, promptDialog } from './lib/dialog';
import StatsModal from './components/StatsModal';
import AccountModal from './components/AccountModal';
import GalleryModal from './components/GalleryModal';
import FilterModal, { EMPTY_FILTER } from './components/FilterModal';
import type { ChatFilter } from './components/FilterModal';
import TranslateModal from './components/TranslateModal';
import SaveModal from './components/SaveModal';
import { translateBatch } from './lib/translate';
import type { FromLang, Lang2 } from './lib/translate';
import Landing from './components/Landing';
import Privacy from './components/Privacy';
import Terms from './components/Terms';
import ResetPasswordModal from './components/ResetPasswordModal';
import { saveChat, onAuthChange, getSharedChat, onPasswordRecovery } from './lib/supabase';
import { exportChat } from './lib/exporter';
import { exportBook } from './lib/bookExporter';
import BookModal from './components/BookModal';
import type { BookConfig } from './lib/bookThemes';
import type { ChatRow } from './lib/supabase';
import { useLang } from './lib/i18n';

const DEFAULT_MODEL = MODELS.find((m) => m.name.startsWith('iPhone 12')) || MODELS[3];

// Restore the editor draft on a refresh — computed once at load. Explicit URL
// entry points (privacy / terms / shared ?c= / room ?room=) take precedence, so
// we only rehydrate the local editor when the URL isn't pointing somewhere else.
const BOOT_DRAFT = (() => {
  try {
    const p = new URLSearchParams(location.search);
    if (p.has('privacy') || p.has('terms') || p.has('c') || p.has('room')) return null;
    return loadScreen() === 'viewer' ? loadDraft() : null;
  } catch { return null; }
})();

export default function App() {
  const { t } = useLang();
  const [screen, setScreen] = useState<'landing' | 'upload' | 'viewer' | 'shared' | 'privacy' | 'terms' | 'continue' | 'myrooms'>(
    () => {
      const p = new URLSearchParams(location.search);
      if (p.has('privacy')) return 'privacy';
      if (p.has('terms')) return 'terms';
      if (p.has('room')) return 'continue';
      if (p.has('c')) return 'landing';          // a shared chat loads via its own effect
      // refresh / reopen → land back on the same page as last time
      if (BOOT_DRAFT) return 'viewer';
      const ls = loadScreen();
      if (ls === 'upload') return 'upload';
      if (ls === 'myrooms') return 'myrooms';
      return 'landing';
    },
  );
  // "Continue chat" live-room mode: either the creator (with an imported chat)
  // or a guest arriving via a ?room=<id> link (autoPin = reopen a saved room).
  const [continueMode, setContinueMode] = useState<
    { mode: 'create'; messages: P.Message[]; senders: string[]; media: Record<string, Blob> } | { mode: 'join'; roomId: string; autoPin?: string } | null
  >(() => {
    const id = new URLSearchParams(location.search).get('room');
    if (!id) return null;
    // If we've been in this room before, reopen it straight away with the saved
    // PIN (no prompt) — so a refresh lands back in the chat, not the join screen.
    const saved = recentRooms().find((r) => r.id === id);
    return { mode: 'join', roomId: id, autoPin: saved?.pin };
  });
  const [recovery, setRecovery] = useState(false);
  const [rawText, setRawText] = useState(BOOT_DRAFT ? JSON.stringify(BOOT_DRAFT.messages) : '');
  const [mediaMap, setMediaMap] = useState<Record<string, string>>(BOOT_DRAFT?.mediaMap ?? {});
  const [mediaBlobs, setMediaBlobs] = useState<Record<string, Blob>>({});
  // A blob: URL pins its Blob in memory until it is revoked. Open a 400-photo
  // chat, then open another, and the first chat's photos never leave the tab.
  // Signed Supabase URLs are http(s) and own nothing, so they are left alone.
  const liveBlobUrls = useRef<string[]>([]);
  useEffect(() => {
    const next = Object.values(mediaMap).filter((u) => u.startsWith('blob:'));
    for (const url of liveBlobUrls.current) if (!next.includes(url)) URL.revokeObjectURL(url);
    liveBlobUrls.current = next;
  }, [mediaMap]);
  useEffect(() => () => { for (const url of liveBlobUrls.current) URL.revokeObjectURL(url); }, []);
  const [messages, setMessages] = useState<P.Message[]>(BOOT_DRAFT?.messages ?? []);
  const [senders, setSenders] = useState<string[]>(BOOT_DRAFT?.senders ?? []);
  const [meName, setMeName] = useState<string | null>(BOOT_DRAFT?.meName ?? null);
  const [contactTitle, setContactTitle] = useState(BOOT_DRAFT?.contactTitle ?? 'Chat');
  const [status, setStatus] = useState(BOOT_DRAFT?.status ?? 'online');
  const [showStatusBar, setShowStatusBar] = useState(BOOT_DRAFT?.showStatusBar ?? true);
  const [dateOrder, setDateOrder] = useState<P.DateOrder>(BOOT_DRAFT?.dateOrder ?? 'DMY');
  const [model, setModel] = useState<PhoneModel>(
    (BOOT_DRAFT && MODELS.find((m) => m.name === BOOT_DRAFT.modelName)) || DEFAULT_MODEL,
  );
  const [theme, setTheme] = useState<'light' | 'dark'>(BOOT_DRAFT?.theme ?? 'light');
  const [showFrame, setShowFrame] = useState(BOOT_DRAFT?.showFrame ?? true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  // Entering edit mode re-renders every row (each grows a toolbar and an
  // editable field), which on a large chat is a heavy render. As a transition
  // it runs in the background: the tab stays scrollable and the Edit button
  // shows it is working, instead of the whole page freezing.
  const [editPending, startEditTransition] = useTransition();
  const toggleEditMode = () => startEditTransition(() => setEditMode((v) => !v));
  const [composeText, setComposeText] = useState('');
  const [composeSide, setComposeSide] = useState<'me' | 'other'>('me');
  const [replyTarget, setReplyTarget] = useState<{ sender: string; text: string } | null>(null);
  const [showTyping, setShowTyping] = useState(BOOT_DRAFT?.showTyping ?? false);
  const [lightbox, setLightbox] = useState<{ url: string; kind: 'img' | 'video' } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState<ChatFilter>(EMPTY_FILTER);
  const [translateOpen, setTranslateOpen] = useState(false);
  const [translations, setTranslations] = useState<Record<number, string>>({});
  const [translated, setTranslated] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [wallpaper, setWallpaper] = useState(BOOT_DRAFT?.wallpaper ?? '');
  const [search, setSearch] = useState('');
  const [matchPos, setMatchPos] = useState(0);
  const [avatar, setAvatar] = useState<string | null>(BOOT_DRAFT?.avatar ?? null);
  const [saving, setSaving] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const [bookExporting, setBookExporting] = useState(false);
  const [bookProgress, setBookProgress] = useState<{ done: number; total: number } | null>(null);
  const [sharedLoading, setSharedLoading] = useState(!!new URLSearchParams(location.search).get('c'));
  const [toastMsg, setToastMsg] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  useEffect(() => onAuthChange(setSession), []);
  // When the user returns from a password-reset email, prompt for a new password.
  useEffect(() => onPasswordRecovery(() => setRecovery(true)), []);

  // Promoter referral tracking: log a visit if the URL has ?ref=<promoter>, and
  // mark an "activated" once they actually open a chat / live room.
  useEffect(() => { captureRef(); }, []);
  useEffect(() => { if (screen === 'viewer' || screen === 'continue') markActivated(); }, [screen]);

  // ---- refresh persistence: reload the same page you were on ----
  // Remember the current page so a refresh reopens it (not the landing screen).
  // 'shared'/'continue'/'privacy'/'terms' restore from their own URL, so we only
  // record the localStorage-driven ones here.
  useEffect(() => {
    if (screen === 'landing' || screen === 'upload' || screen === 'viewer' || screen === 'myrooms') saveScreen(screen);
  }, [screen]);
  // Auto-save the chat you're building/editing (debounced) so a refresh brings it
  // back with all its settings. Media from a .zip (blob: URLs) can't be persisted.
  useEffect(() => {
    if (screen !== 'viewer') return;
    const id = window.setTimeout(() => {
      saveDraft({
        messages, senders, meName, contactTitle, status, showStatusBar, showTyping,
        dateOrder, modelName: model.name, theme, showFrame, wallpaper, avatar, mediaMap,
      });
    }, 600);
    return () => window.clearTimeout(id);
  }, [screen, messages, senders, meName, contactTitle, status, showStatusBar, showTyping, dateOrder, model, theme, showFrame, wallpaper, avatar, mediaMap]);

  // ---- browser/phone Back button support ----
  // Seed history so the FIRST Back press stays INSIDE the app instead of leaving
  // the site. When we boot straight into a deep screen (e.g. someone opening a
  // ?room= invite link), stack 'landing' underneath it, so Back returns to the
  // app (and the chat is one Forward away) instead of dumping them back to
  // wherever they tapped the link. lastPushed = the screen the top history
  // entry currently reflects, so we never push a duplicate.
  type Screen = 'landing' | 'upload' | 'viewer' | 'shared' | 'privacy' | 'terms' | 'continue' | 'myrooms';
  const lastPushed = useRef<Screen>('landing');
  useEffect(() => {
    // On a REFRESH the browser preserves the history stack + our {screen} state,
    // so only seed the "landing underneath" on a genuinely fresh load. Re-seeding
    // every refresh piled up duplicate entries and made Back appear stuck.
    const savedScreen = (window.history.state as { screen?: Screen } | null)?.screen;
    if (!savedScreen) {
      window.history.replaceState({ screen: 'landing' }, '');
      if (screen !== 'landing') window.history.pushState({ screen }, '');
    }
    lastPushed.current = ((window.history.state as { screen?: Screen } | null)?.screen) ?? screen;
    const onPop = (e: PopStateEvent) => {
      const s = (e.state?.screen as Screen) || 'landing';
      lastPushed.current = s;
      setScreen(s);
      setHistoryOpen(false); setAuthOpen(false); setAccountOpen(false); setStatsOpen(false); setSettingsOpen(false);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (screen === lastPushed.current) return;   // already reflected (initial seed or a popstate)
    window.history.pushState({ screen }, '');
    lastPushed.current = screen;
  }, [screen]);

  // open a shared chat if the URL has ?c=<token>
  useEffect(() => {
    const token = new URLSearchParams(location.search).get('c');
    if (!token) return;
    getSharedChat(token).then((row) => {
      if (!row) { toast(t('tSharedNotFound'), 4000); return; }
      setMediaBlobs({});
      setAvatar(row.avatar ?? null);
      applyChat(row.chat_text || '', row.media_map || {}, {
        meName: row.me_name, contactTitle: row.contact_title || row.title, model: row.model, theme: row.theme,
      });
      setScreen('shared');
    }).catch((e) => toast('❌ ' + ((e as Error).message || e), 4000))
      .finally(() => setSharedLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const userEmail = session?.user?.email ?? null;
  const stats = useMemo(() => computeStats(messages), [messages]);

  // Unique chat dates in chronological order — powers the From/To date filter.
  const uniqueDates = useMemo(() => {
    const seen = new Set<string>(); const out: string[] = [];
    for (const m of messages) if (m.date && !seen.has(m.date)) { seen.add(m.date); out.push(m.date); }
    return out;
  }, [messages]);

  // First → last chat day, stamped on the book cover.
  const bookDateRange = useMemo(() => {
    const f = messages.find((m) => m.date)?.date;
    const l = [...messages].reverse().find((m) => m.date)?.date;
    return f && l ? `${P.formatDay(f, dateOrder)}  —  ${P.formatDay(l, dateOrder)}` : '';
  }, [messages, dateOrder]);

  const filterActive = !!(filter.sender || filter.from || filter.to || filter.mediaOnly);

  // Indices to hide (never removed) so search / edit / index alignment all stay intact.
  const hiddenSet = useMemo(() => {
    const hide = new Set<number>();
    if (!filterActive) return hide;
    const pos = new Map(uniqueDates.map((d, i) => [d, i] as const));
    const fromPos = filter.from ? pos.get(filter.from) : undefined;
    const toPos = filter.to ? pos.get(filter.to) : undefined;
    messages.forEach((m, i) => {
      let drop = false;
      if (filter.sender && m.sender !== filter.sender) drop = true;
      if (!drop && (fromPos !== undefined || toPos !== undefined)) {
        const p = pos.get(m.date);
        if (p === undefined) drop = true;
        else if (fromPos !== undefined && p < fromPos) drop = true;
        else if (toPos !== undefined && p > toPos) drop = true;
      }
      if (!drop && filter.mediaOnly && (m.call || !P.findAttachment(m.text))) drop = true;
      if (drop) hide.add(i);
    });
    return hide;
  }, [filterActive, filter, messages, uniqueDates]);

  const visibleCount = messages.length - hiddenSet.size;

  // The search box updates instantly, but recomputing matches and re-highlighting
  // the list over thousands of messages is heavy. Deferring the query lets React
  // keep the input responsive and update the results at a lower priority, so
  // typing never stutters on a big chat.
  const deferredSearch = useDeferredValue(search);
  const matchIndices = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    if (!q) return [] as number[];
    const out: number[] = [];
    messages.forEach((m, i) => {
      if (hiddenSet.has(i)) return;   // don't match rows hidden by the active filter
      if (!m.system && m.sender && P.stripMarks(m.text).toLowerCase().includes(q)) out.push(i);
    });
    return out;
  }, [deferredSearch, messages, hiddenSet]);
  useEffect(() => { setMatchPos(0); }, [deferredSearch]);
  const matchCount = matchIndices.length;
  const activeMsgIndex = matchCount ? matchIndices[Math.min(matchPos, matchCount - 1)] : -1;
  const matchSet = useMemo(() => new Set(matchIndices), [matchIndices]);

  function toast(msg: string, ms = 2500) {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    if (msg && ms > 0) toastTimer.current = window.setTimeout(() => setToastMsg(''), ms);
  }

  // A saved chat stores the edited messages as JSON; a fresh upload is raw WhatsApp text.
  function parseStored(text: string): P.Message[] | null {
    if (!text || text[0] !== '[') return null;
    try {
      const arr = JSON.parse(text);
      if (Array.isArray(arr) && arr.every((m) => m && typeof m.text === 'string' && 'date' in m)) return arr as P.Message[];
    } catch { /* not JSON */ }
    return null;
  }

  function applyChat(
    text: string,
    mmap: Record<string, string>,
    opts?: { meName?: string | null; contactTitle?: string; model?: string; theme?: string },
  ) {
    const msgs = parseStored(text) ?? P.parseChat(text);
    const order = P.detectDateOrder(msgs);
    const set = new Set<string>(); msgs.forEach((m) => { if (m.sender) set.add(m.sender); });
    const snd = [...set];
    const me = opts?.meName && snd.includes(opts.meName) ? opts.meName : (snd[snd.length - 1] || null);
    const other = snd.find((s) => s !== me);
    const title = opts?.contactTitle || (snd.length > 2 ? 'Group chat' : (other || snd[0] || 'Chat'));
    setRawText(text); setMediaMap(mmap); setMessages(msgs); setSenders(snd); setDateOrder(order);
    setMeName(me); setContactTitle(title);
    if (opts?.model) { const mm = MODELS.find((x) => x.name === opts.model); if (mm) setModel(mm); }
    if (opts?.theme === 'dark' || opts?.theme === 'light') setTheme(opts.theme);
    setSearch(''); setFilter(EMPTY_FILTER); setTranslations({}); setTranslated(false);
    setScreen('viewer');
  }

  // rename the "me" participant everywhere in the loaded chat
  function renameMe(newName: string) {
    const t = newName;
    if (!t.trim()) return;                       // don't allow empty names
    if (meName == null) { setMeName(t); return; }
    if (t === meName) return;
    setMessages((msgs) => msgs.map((m) => (m.sender === meName ? { ...m, sender: t } : m)));
    setSenders((s) => s.map((x) => (x === meName ? t : x)));
    setMeName(t);
  }

  // swap which side is "me" (right side)
  function swapSides() {
    if (senders.length < 2) return;
    const idx = Math.max(0, senders.indexOf(meName ?? ''));
    const other = senders[(idx + 1) % senders.length];
    const oldMe = meName;
    setMeName(other);
    if (senders.length === 2 && oldMe) setContactTitle(oldMe);  // header shows the non-me person
  }

  function editText(index: number, text: string) {
    setMessages((msgs) => msgs.map((x, i) => (i === index ? { ...x, text } : x)));
  }
  function deleteMsg(index: number) {
    setMessages((msgs) => msgs.filter((_, i) => i !== index));
  }
  function cycleTick(index: number) {
    setMessages((msgs) => msgs.map((x, i) => (i === index ? { ...x, tick: ((x.tick ?? 3) + 1) % 4 } : x)));
  }
  async function editTime(index: number) {
    const v = await promptDialog({ message: t('pMsgTime'), defaultValue: messages[index]?.time ?? '', confirmLabel: t('dlgSave') });
    if (v != null && v.trim()) setMessages((msgs) => msgs.map((x, i) => (i === index ? { ...x, time: v.trim() } : x)));
  }
  async function editDate(oldDate: string) {
    const v = await promptDialog({ message: t('pMsgDate'), defaultValue: oldDate, confirmLabel: t('dlgSave') });
    if (v != null && v.trim()) setMessages((msgs) => msgs.map((x) => (x.date === oldDate ? { ...x, date: v.trim() } : x)));
  }
  function addMessage() {
    const t = composeText.trim();
    if (!t) return;
    const d = new Date();
    const time = `${((d.getHours() % 12) || 12)}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
    const date = messages.length ? messages[messages.length - 1].date : `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    const other = senders.find((s) => s !== meName) || contactTitle || 'Them';
    const sender = composeSide === 'me' ? (meName || 'You') : other;
    setMessages((msgs) => [...msgs, {
      date, time, sender, text: t, system: false,
      tick: composeSide === 'me' ? 3 : undefined,
      reply: replyTarget || undefined,
    }]);
    if (composeSide === 'me' && !meName) setMeName('You');
    if (!senders.includes(sender)) setSenders((s) => [...s, sender]);
    setComposeText('');
    setReplyTarget(null);
  }
  function addMedia(file: File) {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const fname = `added-${Date.now()}-${Math.random().toString(16).slice(2, 6)}.${ext}`;
    const url = URL.createObjectURL(file);
    setMediaMap((m) => ({ ...m, [fname]: url }));
    setMediaBlobs((m) => ({ ...m, [fname]: file }));
    const d = new Date();
    const time = `${((d.getHours() % 12) || 12)}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
    const date = messages.length ? messages[messages.length - 1].date : `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    const other = senders.find((s) => s !== meName) || contactTitle || 'Them';
    const sender = composeSide === 'me' ? (meName || 'You') : other;
    setMessages((msgs) => [...msgs, {
      date, time, sender, text: `${fname} (file attached)`, system: false,
      tick: composeSide === 'me' ? 3 : undefined, reply: replyTarget || undefined,
    }]);
    if (composeSide === 'me' && !meName) setMeName('You');
    if (!senders.includes(sender)) setSenders((s) => [...s, sender]);
    setReplyTarget(null);
  }
  function replyTo(index: number) {
    const m = messages[index];
    if (m) setReplyTarget({ sender: m.sender || '', text: P.stripMarks(m.text).slice(0, 90) });
  }
  function addReaction(index: number, emoji: string) {
    setMessages((msgs) => msgs.map((x, i) => {
      if (i !== index) return x;
      const rs = x.reactions || [];
      return { ...x, reactions: rs.includes(emoji) ? rs.filter((e) => e !== emoji) : [...rs, emoji] };
    }));
  }
  function toggleForward(index: number) {
    setMessages((msgs) => msgs.map((x, i) => (i === index ? { ...x, forwarded: !x.forwarded } : x)));
  }
  async function insertSpecial(type: string) {
    const d = new Date();
    const time = `${((d.getHours() % 12) || 12)}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
    const date = messages.length ? messages[messages.length - 1].date : `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    const other = senders.find((s) => s !== meName) || contactTitle || 'Them';
    const meSender = meName || 'You';
    const add = (m: Partial<P.Message>) => setMessages((msgs) => [...msgs, { date, time, sender: null, text: '', system: false, ...m } as P.Message]);

    if (type === 'encrypt') {
      add({ system: true, text: '🔒 Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.' });
    } else if (type === 'system') {
      const v = await promptDialog({ message: t('pSystemMsg'), defaultValue: '' });
      if (v && v.trim()) add({ system: true, text: v.trim() });
    } else if (type === 'deleted') {
      add({ sender: composeSide === 'me' ? meSender : other, text: 'This message was deleted' });
    } else if (type.startsWith('call')) {
      const missed = type === 'call-missed';
      const media: 'voice' | 'video' = type === 'call-video' ? 'video' : 'voice';
      const title = missed ? `Missed ${media} call` : `${media === 'video' ? 'Video' : 'Voice'} call`;
      const sub = missed ? 'Tap to call back' : ((await promptDialog({ message: t('pCallDetails'), defaultValue: 'No answer' })) || '');
      add({ sender: missed ? other : (composeSide === 'me' ? meSender : other), call: { media, title, sub, missed } });
    }
    if ((type === 'deleted' || type.startsWith('call')) && composeSide === 'me' && !meName) setMeName('You');
  }

  function onLoaded(l: LoadedChat) {
    setMediaBlobs(l.mediaBlobs);
    setAvatar(null);
    applyChat(l.rawText, l.mediaMap);
  }

  function startBlank() {
    const d = new Date();
    const date = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    const seed: P.Message[] = [
      { date, time: '10:00 AM', sender: 'Contact', text: 'Hey! 👋', system: false },
      { date, time: '10:01 AM', sender: 'You', text: 'Turn on ✏️ Edit and start adding your own messages!', system: false, tick: 3 },
    ];
    setRawText(''); setMediaMap({}); setMediaBlobs({}); setAvatar(null);
    setMessages(seed); setSenders(['Contact', 'You']); setDateOrder('DMY');
    setMeName('You'); setContactTitle('Contact'); setSearch(''); setFilter(EMPTY_FILTER);
    setTranslations({}); setTranslated(false);
    setEditMode(true);
    setScreen('viewer');
  }

  function onOpenChat(row: ChatRow) {
    setMediaBlobs({});
    setAvatar(row.avatar ?? null);
    applyChat(row.chat_text || '', row.media_map || {}, {
      meName: row.me_name, contactTitle: row.contact_title || row.title, model: row.model, theme: row.theme,
    });
    setHistoryOpen(false);
    toast('');
  }

  function openHistory() {
    if (!session) { setAuthOpen(true); toast(t('tLoginViewHist'), 2500); return; }
    setHistoryOpen(true);
  }

  async function onExport(mode: 'png' | 'pdf') {
    toast(mode === 'png' ? t('tExportImg') : t('tExportPdf'), 0);
    try { await exportChat(mode, contactTitle); toast(t('tDownloaded'), 2200); }
    catch (e) { toast('❌ ' + ((e as Error).message || e), 4000); }
  }

  async function doExportBook(config: BookConfig) {
    setBookExporting(true);
    setBookProgress({ done: 0, total: 0 });
    toast(t('tBook'), 0);
    try {
      await exportBook(
        { title: contactTitle, meName, senders, dateOrder, messages, mediaMap, msgCount: stats.total, avatar, wallpaper },
        config,
        (done, total) => setBookProgress({ done, total }),
      );
      toast(t('tBookDone'), 2500);
      setBookOpen(false);
    } catch (e) { toast('❌ ' + ((e as Error).message || e), 4000); }
    finally { setBookExporting(false); setBookProgress(null); }
  }

  async function translateWholeChat(from: FromLang, to: Lang2) {
    const idxs: number[] = [], texts: string[] = [];
    messages.forEach((m, i) => {
      let t: string | null = null;
      if (m.call) t = null;
      else if (m.system || !m.sender) t = P.stripMarks(m.text).trim() || null;
      else {
        const att = P.findAttachment(m.text);
        if (att) t = P.extractCaption(m.text, att).trim() || null;
        else if (P.PLACEHOLDERS.test(m.text)) t = null;
        else t = P.stripMarks(m.text).trim() || null;
      }
      if (t) { idxs.push(i); texts.push(t); }
    });
    if (!texts.length) { toast(t('tNothingTr'), 2500); return; }
    setTranslateOpen(false); setTranslating(true);
    toast(`${t('tTrProgress')} 0 / ${texts.length}…`, 0);
    try {
      const out = await translateBatch(texts, from, to, (done, total) => toast(`${t('tTrProgress')} ${done} / ${total}…`, 0));
      const map: Record<number, string> = {};
      idxs.forEach((mi, k) => { map[mi] = out[k]; });
      setTranslations(map); setTranslated(true);
      toast(t('tTrDone'), 2500);
    } catch (e) {
      toast('❌ ' + ((e as Error).message || e), 4500);
    } finally {
      setTranslating(false);
    }
  }

  function onSave() {
    if (!rawText) { alertDialog({ message: t('tLoadFirst') }); return; }
    if (!session) { setAuthOpen(true); toast(t('tLoginSaveHist'), 2500); return; }
    setSaveOpen(true);
  }
  async function doSave(category: string | null) {
    setSaving(true);
    try {
      const res = await saveChat(
        { contactTitle, meName, model: model.name, theme, rawText: JSON.stringify(messages),
          msgCount: stats.total, mediaCount: stats.mediaCount, avatar, category },
        mediaBlobs,
        (i, total) => toast(`${t('tUploading')} ${i} / ${total}…`, 0),
      );
      setSaveOpen(false);
      // Don't claim a clean save if some photos didn't make it — the user can
      // save again to retry just as easily as being misled.
      if (res.failed > 0) toast(t('tSavedPartial').replace('{a}', String(res.failed)).replace('{b}', String(res.total)), 6000);
      else toast(t('tSaved'), 2500);
    } catch (e) {
      console.error(e);
      toast(t('tSaveFail') + ' ' + ((e as Error).message || e), 4500);
    } finally {
      setSaving(false);
    }
  }

  if (sharedLoading) {
    return (
      <div className="load-full">
        <span className="spinner lg" />
        <span className="lf-brand">💬 Chat Tree</span>
        <span className="lf-text">{t('shOpening')}</span>
      </div>
    );
  }

  if (new URLSearchParams(location.search).has('refstats')) {
    return (
      <>
        <RefStats userEmail={userEmail} onLogin={() => setAuthOpen(true)}
          onBack={() => { window.history.replaceState(window.history.state, '', location.origin + '/'); setScreen('landing'); }} />
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} toast={toast} />
        <ResetPasswordModal open={recovery} onDone={() => setRecovery(false)} toast={toast} />
      </>
    );
  }

  if (screen === 'privacy') {
    return <><Privacy onBack={() => setScreen('landing')} /><ResetPasswordModal open={recovery} onDone={() => setRecovery(false)} toast={toast} /></>;
  }

  if (screen === 'terms') {
    return <><Terms onBack={() => setScreen('landing')} /><ResetPasswordModal open={recovery} onDone={() => setRecovery(false)} toast={toast} /></>;
  }

  if (screen === 'continue' && continueMode) {
    return (
      <>
        <ContinueChat
          mode={continueMode.mode}
          importedMessages={continueMode.mode === 'create' ? continueMode.messages : undefined}
          importedSenders={continueMode.mode === 'create' ? continueMode.senders : undefined}
          importedMedia={continueMode.mode === 'create' ? continueMode.media : undefined}
          roomId={continueMode.mode === 'join' ? continueMode.roomId : undefined}
          autoPin={continueMode.mode === 'join' ? continueMode.autoPin : undefined}
          userEmail={userEmail}
          onLogin={() => setAuthOpen(true)}
          onHome={() => {
            // drop ?room= so a later refresh on the home screen doesn't jump back in
            const u = new URL(window.location.href);
            if (u.searchParams.has('room')) { u.searchParams.delete('room'); window.history.replaceState(window.history.state, '', u); }
            setContinueMode(null); setScreen('landing');
          }}
        />
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} toast={toast} />
        <ResetPasswordModal open={recovery} onDone={() => setRecovery(false)} toast={toast} />
      </>
    );
  }

  if (screen === 'myrooms') {
    return (
      <>
        <MyRooms
          userEmail={userEmail}
          onOpen={(roomId, pin) => { setContinueMode({ mode: 'join', roomId, autoPin: pin }); setScreen('continue'); }}
          onBack={() => setScreen('upload')}
          onLogin={() => setAuthOpen(true)}
        />
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} toast={toast} />
        <ResetPasswordModal open={recovery} onDone={() => setRecovery(false)} toast={toast} />
      </>
    );
  }

  if (screen === 'landing') {
    return (
      <>
        <Landing onLaunch={() => setScreen('upload')} onPrivacy={() => setScreen('privacy')} onTerms={() => setScreen('terms')} />
        <ResetPasswordModal open={recovery} onDone={() => setRecovery(false)} toast={toast} />
        <div className={'toast' + (toastMsg ? ' show' : '')}>{toastMsg}</div>
      </>
    );
  }

  if (screen === 'shared') {
    return (
      <>
        <div className="shared-bar">
          <span className="sb-title">{t('shSharedRO')}</span>
          <a className="sb-open" href={location.origin}>{t('shOpen')}</a>
        </div>
        <PhoneViewer
          messages={messages} meName={meName} senders={senders} mediaMap={mediaMap}
          dateOrder={dateOrder} model={model} theme={theme} showFrame={showFrame}
          layoutSignal="" contactTitle={contactTitle} status={status} showStatusBar={showStatusBar} wallpaper={wallpaper}
          avatar={avatar} matchSet={matchSet} activeMsgIndex={activeMsgIndex}
          search={search} onSearch={setSearch} matchCount={matchCount} matchPos={matchPos}
          onPrevMatch={() => setMatchPos((p) => (p - 1 + matchCount) % matchCount)}
          onNextMatch={() => setMatchPos((p) => (p + 1) % matchCount)}
          onOpenMedia={(url, kind) => setLightbox({ url, kind })}
        />
        <Lightbox media={lightbox} onClose={() => setLightbox(null)} />
        <ResetPasswordModal open={recovery} onDone={() => setRecovery(false)} toast={toast} />
        <div className={'toast' + (toastMsg ? ' show' : '')}>{toastMsg}</div>
      </>
    );
  }

  return (
    <>
      {screen === 'upload' ? (
        <Uploader
          onLoaded={onLoaded} onHistory={openHistory} onBlank={startBlank} onHome={() => setScreen('landing')}
          onContinue={(l) => {
            const msgs = P.parseChat(l.rawText);
            const set = new Set<string>(); msgs.forEach((m) => { if (m.sender) set.add(m.sender); });
            setContinueMode({ mode: 'create', messages: msgs, senders: [...set], media: l.mediaBlobs });
            setScreen('continue');
          }}
          onContinueFresh={() => { setContinueMode({ mode: 'create', messages: [], senders: [], media: {} }); setScreen('continue'); }}
          onMyRooms={() => setScreen('myrooms')}
          userEmail={userEmail} onLogin={() => setAuthOpen(true)} onAccount={() => setAccountOpen(true)}
        />
      ) : (
        <>
          <Toolbar
            meName={meName} onRenameMe={renameMe} onSwap={swapSides}
            model={model} onModel={setModel}
            contactTitle={contactTitle} onTitle={setContactTitle}
            status={status} onStatus={setStatus}
            showStatusBar={showStatusBar} onToggleStatusBar={() => setShowStatusBar((v) => !v)}
            showTyping={showTyping} onToggleTyping={() => setShowTyping((v) => !v)}
            settingsOpen={settingsOpen} onToggleSettings={() => setSettingsOpen((v) => !v)}
            editMode={editMode} onEditMode={toggleEditMode} editPending={editPending} onHome={() => setScreen('landing')}
            userEmail={userEmail} onLogin={() => setAuthOpen(true)} onAccount={() => setAccountOpen(true)}
            wallpaper={wallpaper} onWallpaper={setWallpaper}
            avatar={avatar} onAvatar={setAvatar}
          />
          <PhoneViewer
            messages={messages} meName={meName} senders={senders} mediaMap={mediaMap}
            dateOrder={dateOrder} model={model} theme={theme} showFrame={showFrame}
            layoutSignal={`${settingsOpen}`} contactTitle={contactTitle} status={status} showStatusBar={showStatusBar} wallpaper={wallpaper}
            avatar={avatar} matchSet={matchSet} activeMsgIndex={activeMsgIndex}
            hiddenSet={hiddenSet} filterActive={filterActive} visibleCount={visibleCount} onClearFilter={() => setFilter(EMPTY_FILTER)}
            translations={translations} translated={translated} onToggleTranslated={() => setTranslated((v) => !v)}
            editMode={editMode} onEditText={editText} onDeleteMsg={deleteMsg} onCycleTick={cycleTick}
            onEditTime={editTime} onEditDate={editDate} onReply={replyTo} onReact={addReaction}
            onForward={toggleForward} showTyping={showTyping}
            compose={{
              text: composeText, onText: setComposeText, side: composeSide,
              onToggleSide: () => setComposeSide((s) => (s === 'me' ? 'other' : 'me')), onSend: addMessage,
              replyTo: replyTarget, onCancelReply: () => setReplyTarget(null), onAddMedia: addMedia,
              onInsert: insertSpecial,
            }}
            search={search} onSearch={setSearch} matchCount={matchCount} matchPos={matchPos}
            onPrevMatch={() => setMatchPos((p) => (p - 1 + matchCount) % matchCount)}
            onNextMatch={() => setMatchPos((p) => (p + 1) % matchCount)}
            onOpenMedia={(url, kind) => setLightbox({ url, kind })}
            actions={{
              onStats: () => setStatsOpen(true),
              onGallery: () => setGalleryOpen(true),
              onFilter: () => setFilterOpen(true),
              onTranslate: () => setTranslateOpen(true),
              onExportImg: () => onExport('png'),
              onExportPdf: () => onExport('pdf'),
              onExportBook: () => setBookOpen(true),
              onSave, saving,
              onTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
              onFrame: () => setShowFrame((f) => !f), showFrame,
              onNew: () => setScreen('upload'),
            }}
          />
        </>
      )}
      <Lightbox media={lightbox} onClose={() => setLightbox(null)} />
      <HistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} onOpenChat={onOpenChat} toast={toast} />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} toast={toast} />
      <AccountModal open={accountOpen} onClose={() => setAccountOpen(false)} email={userEmail} toast={toast} />
      <StatsModal open={statsOpen} onClose={() => setStatsOpen(false)} stats={stats} dateOrder={dateOrder} title={contactTitle} />
      <GalleryModal open={galleryOpen} onClose={() => setGalleryOpen(false)} messages={messages} mediaMap={mediaMap}
        onOpen={(url, kind) => { setGalleryOpen(false); setLightbox({ url, kind }); }} />
      <FilterModal open={filterOpen} onClose={() => setFilterOpen(false)} senders={senders} dates={uniqueDates}
        dateOrder={dateOrder} value={filter} onChange={setFilter} onClear={() => setFilter(EMPTY_FILTER)}
        visibleCount={visibleCount} totalCount={messages.length} />
      <TranslateModal open={translateOpen} onClose={() => setTranslateOpen(false)}
        onTranslateChat={translateWholeChat} translating={translating} translated={translated} />
      <SaveModal open={saveOpen} onClose={() => setSaveOpen(false)} onSave={doSave} saving={saving} />
      <BookModal open={bookOpen} onClose={() => setBookOpen(false)} onExport={doExportBook}
        exporting={bookExporting} progress={bookProgress}
        defaultTitle={contactTitle} avatar={avatar} meName={meName} senders={senders}
        msgCount={stats.total} days={stats.days} mediaCount={stats.mediaCount} dateRange={bookDateRange} />
      <ResetPasswordModal open={recovery} onDone={() => setRecovery(false)} toast={toast} />
      <div className={'toast' + (toastMsg ? ' show' : '')}>{toastMsg}</div>
    </>
  );
}
