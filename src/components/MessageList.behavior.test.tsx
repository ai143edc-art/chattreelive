// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import MessageList, { rowPropsEqual, applyHighlights } from './MessageList';
import type { RowProps } from './MessageList';
import type { Message } from '../lib/parser';

/**
 * The memo on each row skips re-rendering rows whose data did not change. The
 * risk with that is the opposite of a slow render: a row that *should* update
 * but doesn't (a stale bubble). These re-render the same list with one thing
 * changed at a time and assert the affected row actually changes — the failure
 * mode a single server-render snapshot cannot catch.
 */
afterEach(cleanup);

const M = (m: Partial<Message>): Message =>
  ({ date: '01/06/2026', time: '09:00', sender: 'Riya', text: 'hi', system: false, ...m });

const base = {
  meName: 'Vikku', senders: ['Riya', 'Vikku'],
  mediaMap: {} as Record<string, string>, dateOrder: 'DMY' as const, onOpenMedia: () => {},
};

it('edited message text updates the row (new object bypasses memo)', () => {
  const msgs = [M({ sender: 'Riya', text: 'before' }), M({ sender: 'Vikku', text: 'other' })];
  const { container, rerender } = render(<MessageList {...base} messages={msgs} />);
  expect(container.querySelector('[data-mi="0"]')!.textContent).toContain('before');
  // App edits by returning a new array with a new object at index 0.
  const edited = [{ ...msgs[0], text: 'after' }, msgs[1]];
  rerender(<MessageList {...base} messages={edited} />);
  expect(container.querySelector('[data-mi="0"]')!.textContent).toContain('after');
  expect(container.querySelector('[data-mi="1"]')!.textContent).toContain('other');
});

it('applyHighlights paints matches onto the rows, moves the active one, and clears', () => {
  const msgs = [M({ text: 'photo a' }), M({ text: 'photo b' }), M({ text: 'photo c' })];
  const { container } = render(<MessageList {...base} messages={msgs} />);
  // Rows render plain: highlighting is a DOM pass, not part of the list output —
  // that is what keeps a search keystroke off the reconciler on a big chat.
  expect(container.querySelector('[data-mi="0"]')!.className).not.toContain('hl');

  applyHighlights(container as HTMLElement, new Set([0, 2]), 0);
  expect(container.querySelector('[data-mi="0"]')!.className).toContain('hl');
  expect(container.querySelector('[data-mi="0"]')!.className).toContain('hla');
  expect(container.querySelector('[data-mi="1"]')!.className).not.toContain('hl');
  expect(container.querySelector('[data-mi="2"]')!.className).toContain('hl');
  expect(container.querySelector('[data-mi="2"]')!.className).not.toContain('hla');

  // Moving the active match lights the new row and drops the old active class.
  applyHighlights(container as HTMLElement, new Set([0, 2]), 2);
  expect(container.querySelector('[data-mi="0"]')!.className).not.toContain('hla');
  expect(container.querySelector('[data-mi="2"]')!.className).toContain('hla');

  // An empty set clears every highlight.
  applyHighlights(container as HTMLElement, undefined, -1);
  expect(container.querySelector('[data-mi="0"]')!.className).not.toContain('hl');
  expect(container.querySelector('[data-mi="2"]')!.className).not.toContain('hl');
});

it('toggling translation swaps the text and back', () => {
  const msgs = [M({ sender: 'Riya', text: 'hello' })];
  const { container, rerender } = render(<MessageList {...base} messages={msgs} />);
  expect(container.querySelector('[data-mi="0"]')!.textContent).toContain('hello');
  rerender(<MessageList {...base} messages={msgs} translated translations={{ 0: 'नमस्ते' }} />);
  expect(container.querySelector('[data-mi="0"]')!.textContent).toContain('नमस्ते');
  rerender(<MessageList {...base} messages={msgs} translated={false} translations={{ 0: 'नमस्ते' }} />);
  expect(container.querySelector('[data-mi="0"]')!.textContent).toContain('hello');
});

it('a newly added media URL resolves on the row that was waiting for it', () => {
  const msgs = [M({ sender: 'Riya', text: 'pic.jpg (file attached)' })];
  const { container, rerender } = render(<MessageList {...base} messages={msgs} mediaMap={{}} />);
  // no url yet → placeholder label, no <img>
  expect(container.querySelector('[data-mi="0"] img')).toBeNull();
  rerender(<MessageList {...base} messages={msgs} mediaMap={{ 'pic.jpg': 'blob:pic' }} />);
  expect(container.querySelector('[data-mi="0"] img')).not.toBeNull();
});

it('entering edit mode adds the delete tool to every row', () => {
  const msgs = [M({ sender: 'Riya', text: 'a' }), M({ sender: 'Vikku', text: 'b' })];
  const { container, rerender } = render(<MessageList {...base} messages={msgs} />);
  expect(container.querySelectorAll('.msg-tools').length).toBe(0);
  rerender(
    <MessageList {...base} messages={msgs} editMode
      onEditText={() => {}} onDeleteMsg={() => {}} onCycleTick={() => {}} onEditTime={() => {}}
      onReply={() => {}} onReact={() => {}} onForward={() => {}} onEditDate={() => {}} />,
  );
  expect(container.querySelectorAll('.msg-tools').length).toBe(2);
});

describe('memo contract: what makes a row re-render', () => {
  const props = (o: Partial<RowProps>): RowProps => ({
    m: M({ text: 'x' }), mi: 0, out: false, grp: false, isGroup: false,
    translation: null, mediaUrl: undefined,
    editMode: false, onOpenMedia: () => {}, ...o,
  });

  it('skips the row when only the action callbacks differ (the whole point)', () => {
    const a = props({ onDeleteMsg: () => {}, onReply: () => {} });
    const b = props({ m: a.m, onDeleteMsg: () => {}, onReply: () => {} });   // fresh callbacks, same data
    expect(rowPropsEqual(a, b)).toBe(true);
  });

  it('re-renders when any value the markup depends on changes', () => {
    const a = props({});
    for (const change of [
      { translation: 'x' }, { mediaUrl: 'blob:y' },
      { editMode: true }, { out: true }, { grp: true }, { isGroup: true }, { mi: 1 },
      { m: M({ text: 'different' }) },
    ]) {
      expect(rowPropsEqual(a, props(change))).toBe(false);
    }
  });
});
