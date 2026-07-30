import type { Message } from './parser';
import { findAttachment, stripMarks } from './parser';

export interface Stats {
  total: number;
  perSender: { name: string; count: number }[];
  mediaCount: number;
  wordCount: number;
  emojiCount: number;
  days: number;
  firstDate: string;
  lastDate: string;
  busiestDate: string;
  busiestCount: number;
  avgPerDay: number;
}

export function computeStats(messages: Message[]): Stats {
  const perSender: Record<string, number> = {};
  const perDate: Record<string, number> = {};
  let total = 0, mediaCount = 0, wordCount = 0, emojiCount = 0;
  let firstDate = '', lastDate = '';

  for (const m of messages) {
    if (m.system || !m.sender) continue;
    total++;
    perSender[m.sender] = (perSender[m.sender] || 0) + 1;
    perDate[m.date] = (perDate[m.date] || 0) + 1;
    if (!firstDate) firstDate = m.date;
    lastDate = m.date;

    if (findAttachment(m.text)) {
      mediaCount++;
    } else {
      const t = stripMarks(m.text).trim();
      if (t) wordCount += t.split(/\s+/).filter(Boolean).length;
    }
    emojiCount += (stripMarks(m.text).match(/\p{Extended_Pictographic}/gu) || []).length;
  }

  const perSenderArr = Object.entries(perSender)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  let busiestDate = '', busiestCount = 0;
  for (const [d, c] of Object.entries(perDate)) if (c > busiestCount) { busiestCount = c; busiestDate = d; }

  const days = Object.keys(perDate).length;
  return {
    total, perSender: perSenderArr, mediaCount, wordCount, emojiCount,
    days, firstDate, lastDate, busiestDate, busiestCount,
    avgPerDay: days ? Math.round(total / days) : 0,
  };
}
