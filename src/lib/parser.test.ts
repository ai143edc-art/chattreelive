import { describe, it, expect } from 'vitest';
import {
  parseChat, detectDateOrder, formatDay, findAttachment, extractCaption,
  mediaLabel, placeholderLabel, PLACEHOLDERS, emojiInfo, shortTime, initial,
} from './parser';

describe('parseChat', () => {
  it('reads the Android export format', () => {
    const [m] = parseChat('12/06/2026, 09:00 - Riya: Kal milte hai?');
    expect(m).toMatchObject({ date: '12/06/2026', time: '09:00', sender: 'Riya', text: 'Kal milte hai?', system: false });
  });

  it('reads the iOS export format, brackets and 12-hour clock', () => {
    const [m] = parseChat('[12/06/2026, 9:00:15 PM] Riya: Hi');
    expect(m.sender).toBe('Riya');
    expect(m.time).toBe('9:00:15 PM');
    expect(m.text).toBe('Hi');
  });

  it('marks a line with no sender as a system message', () => {
    const [m] = parseChat('12/06/2026, 09:00 - Messages are end-to-end encrypted');
    expect(m.system).toBe(true);
    expect(m.sender).toBeNull();
  });

  it('keeps a colon that belongs to the message, not the sender', () => {
    const [m] = parseChat('12/06/2026, 09:00 - Riya: time is 9:00 sharp');
    expect(m.sender).toBe('Riya');
    expect(m.text).toBe('time is 9:00 sharp');
  });

  it('folds a wrapped line into the message above it', () => {
    const [m] = parseChat('12/06/2026, 09:00 - Riya: line one\nline two');
    expect(m.text).toBe('line one\nline two');
  });

  it('drops a leading line that belongs to no message', () => {
    expect(parseChat('stray text with no timestamp')).toHaveLength(0);
  });
});

describe('detectDateOrder', () => {
  const at = (date: string) => [{ date, time: '09:00', sender: 'a', text: 'x', system: false }];

  it('reads a day above 12 as day-first', () => {
    expect(detectDateOrder(at('13/06/2026'))).toBe('DMY');
  });

  it('reads a second field above 12 as month-first', () => {
    expect(detectDateOrder(at('06/13/2026'))).toBe('MDY');
  });

  it('falls back to day-first when nothing disambiguates', () => {
    expect(detectDateOrder(at('06/07/2026'))).toBe('DMY');
  });
});

describe('formatDay', () => {
  it('reads the same date both ways', () => {
    expect(formatDay('06/07/2026', 'DMY')).toBe('6 July 2026');
    expect(formatDay('06/07/2026', 'MDY')).toBe('7 June 2026');
  });

  it('expands a two-digit year', () => {
    expect(formatDay('06/07/26', 'DMY')).toBe('6 July 2026');
  });

  it('hands back anything it cannot make sense of', () => {
    expect(formatDay('06/13/2026', 'DMY')).toBe('06/13/2026');
    expect(formatDay('not a date', 'DMY')).toBe('not a date');
  });
});

describe('findAttachment', () => {
  it('finds the iOS <attached: …> form', () => {
    expect(findAttachment('‎<attached: 00000042-PHOTO-2026-07-09.jpg>')).toBe('00000042-PHOTO-2026-07-09.jpg');
  });

  it('finds the Android "(file attached)" form', () => {
    expect(findAttachment('IMG-20260709-WA0001.jpg (file attached)')).toBe('IMG-20260709-WA0001.jpg');
  });

  it('finds a bare filename on its own line', () => {
    expect(findAttachment('IMG-20260709-WA0001.jpg')).toBe('IMG-20260709-WA0001.jpg');
  });

  it('does not mistake ordinary prose for a file', () => {
    expect(findAttachment('see you at 5 p.m. sharp')).toBeNull();
    expect(findAttachment('Kal milte hai?')).toBeNull();
  });
});

describe('extractCaption', () => {
  it('keeps the caption and drops the filename', () => {
    const text = 'IMG-20260709-WA0001.jpg (file attached)\nBahut acchi aayi hai';
    expect(extractCaption(text, 'IMG-20260709-WA0001.jpg')).toBe('Bahut acchi aayi hai');
  });

  it('returns nothing when the message is only the file', () => {
    expect(extractCaption('<attached: a.jpg>', 'a.jpg')).toBe('');
  });
});

describe('labels', () => {
  it('names a file by its extension', () => {
    expect(mediaLabel('jpg')).toBe('📷 Photo');
    expect(mediaLabel('opus')).toBe('🎤 Voice message');
    expect(mediaLabel('pdf')).toBe('📄 Document');
    expect(mediaLabel('xyz')).toBe('📎 File');
  });

  it('names a placeholder by what it says', () => {
    expect(placeholderLabel('image omitted')).toBe('📷 Photo');
    expect(placeholderLabel('This message was deleted')).toBe('🚫 This message was deleted');
  });

  it('recognises the placeholders WhatsApp actually writes', () => {
    expect(PLACEHOLDERS.test('<Media omitted>')).toBe(true);
    expect(PLACEHOLDERS.test('sticker omitted')).toBe(true);
    expect(PLACEHOLDERS.test('a real message')).toBe(false);
  });
});

describe('presentation helpers', () => {
  it('treats an emoji-only message as emoji-only', () => {
    expect(emojiInfo('🔥')).not.toBeNull();
    expect(emojiInfo('🔥 pakka')).toBeNull();
  });

  it('shortens a time to hours and minutes', () => {
    expect(shortTime('9:00:15 PM')).toBe('9:00 PM');
    expect(shortTime('09:00')).toBe('09:00');
  });

  it('takes the first letter for an avatar', () => {
    expect(initial('riya')).toBe('R');
    expect(initial('')).toBe('?');
  });
});
