import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import MessageList from './MessageList';
import type { Message } from '../lib/parser';

const M = (m: Partial<Message>): Message =>
  ({ date: '01/06/2026', time: '09:00', sender: 'Riya', text: 'hi', system: false, ...m });

const base = {
  meName: 'Vikku', mediaMap: { 'pic.jpg': 'blob:pic', 'clip.mp4': 'blob:clip', 'doc.pdf': 'blob:doc' },
  dateOrder: 'DMY' as const, onOpenMedia: () => {},
};

const twoParty = ['Riya', 'Vikku'];
const group = ['Riya', 'Vikku', 'Sana'];

const cases: Record<string, { messages: Message[]; senders: string[]; extra?: Record<string, unknown> }> = {
  'two-party text, grouped run': {
    senders: twoParty,
    messages: [
      M({ sender: 'Riya', text: 'Kal milte hai?' }),
      M({ sender: 'Vikku', text: 'Haan pakka', tick: 3 }),
      M({ sender: 'Vikku', text: 'Pakka pakka', tick: 2 }),
    ],
  },
  'group chat with sender colours': {
    senders: group,
    messages: [
      M({ sender: 'Riya', text: 'hi all' }),
      M({ sender: 'Sana', text: 'hello' }),
      M({ sender: 'Vikku', text: 'yo', tick: 1 }),
    ],
  },
  'media: image, video, doc, and missing': {
    senders: twoParty,
    messages: [
      M({ sender: 'Riya', text: 'pic.jpg (file attached)' }),
      M({ sender: 'Riya', text: 'clip.mp4 (file attached)' }),
      M({ sender: 'Riya', text: 'doc.pdf (file attached)' }),
      M({ sender: 'Riya', text: 'gone.jpg (file attached)' }),
      M({ sender: 'Riya', text: 'pic.jpg (file attached)\nwith a caption' }),
    ],
  },
  'reply, reactions, forwarded': {
    senders: twoParty,
    messages: [
      M({ sender: 'Vikku', text: 'see this', forwarded: true }),
      M({ sender: 'Riya', text: 'nice', reply: { sender: 'Vikku', text: 'see this' }, reactions: ['❤️', '😂'] }),
    ],
  },
  'call rows and system message': {
    senders: twoParty,
    messages: [
      M({ sender: null, text: 'Messages are end-to-end encrypted', system: true }),
      M({ sender: 'Vikku', text: '', call: { media: 'voice', title: 'Voice call', sub: '3:12', missed: false } }),
      M({ sender: 'Riya', text: '', call: { media: 'video', title: 'Missed video call', sub: 'Tap to call back', missed: true } }),
    ],
  },
  'emoji-only and placeholder': {
    senders: twoParty,
    messages: [
      M({ sender: 'Vikku', text: '🔥' }),
      M({ sender: 'Riya', text: '<Media omitted>' }),
    ],
  },
  'filter hides the middle message': {
    senders: twoParty,
    extra: { hiddenSet: new Set([1]) },
    messages: [
      M({ sender: 'Riya', text: 'one' }),
      M({ sender: 'Vikku', text: 'two' }),
      M({ sender: 'Riya', text: 'three' }),
    ],
  },
  'translated overlay': {
    senders: twoParty,
    extra: { translated: true, translations: { 0: 'नमस्ते', 1: 'ठीक है' } },
    messages: [
      M({ sender: 'Riya', text: 'hello' }),
      M({ sender: 'Vikku', text: 'okay' }),
    ],
  },
  'edit mode: tools, editable text, clickable ticks': {
    senders: twoParty,
    extra: { editMode: true, onEditText: () => {}, onDeleteMsg: () => {}, onCycleTick: () => {}, onEditTime: () => {}, onEditDate: () => {}, onReply: () => {}, onReact: () => {}, onForward: () => {} },
    messages: [
      M({ sender: 'Vikku', text: 'editable one', tick: 3 }),
      M({ sender: 'Riya', text: 'pic.jpg (file attached)' }),
    ],
  },
  'typing indicator': {
    senders: twoParty,
    extra: { showTyping: true },
    messages: [M({ sender: 'Riya', text: 'hi' })],
  },
};

describe('MessageList DOM output (golden)', () => {
  for (const [name, c] of Object.entries(cases)) {
    it(name, () => {
      const html = renderToStaticMarkup(
        <MessageList messages={c.messages} senders={c.senders} {...base} {...(c.extra || {})} />,
      );
      expect(html).toMatchSnapshot();
    });
  }
});
