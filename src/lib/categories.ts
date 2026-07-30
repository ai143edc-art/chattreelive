export const CATEGORY_PRESETS = ['Family', 'Friends', 'Love', 'Work', 'Study', 'Other'] as const;

const EMOJI: Record<string, string> = {
  Family: '👨‍👩‍👧', Friends: '🧑‍🤝‍🧑', Love: '❤️', Work: '💼', Study: '📚', Other: '📁',
};

/** Emoji for a category label (custom labels get a generic tag). */
export function catEmoji(cat?: string | null): string {
  if (!cat) return '🏷️';
  return EMOJI[cat] || '🏷️';
}
