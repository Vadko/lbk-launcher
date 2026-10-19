import type { AchText } from './achievement-text';

interface FieldMemory {
  orig: string;
  ours: Set<string>;
}

// Keeps Steam's text and every string written over it, so restoring never depends on the current translation.
export function createTextMemory() {
  const fields = new Map<string, FieldMemory>();
  // The text to show: the translation when there is one, otherwise Steam's own.
  const show = (
    appid: unknown,
    id: unknown,
    field: keyof AchText,
    current: string,
    text: string | undefined
  ): string => {
    const key = `${String(appid)}\u0000${String(id)}\u0000${field}`;
    const entry = fields.get(key);
    if (text === undefined) {
      return entry?.ours.has(current) ? entry.orig : current;
    }
    if (current === text) {
      return text;
    }
    if (!entry) {
      fields.set(key, { orig: current, ours: new Set([text]) });
    } else {
      if (!entry.ours.has(current)) {
        entry.orig = current;
      }
      entry.ours.add(text);
    }
    return text;
  };
  return { show };
}
