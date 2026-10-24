import { describe, expect, it } from 'vitest';
import { be } from './be';
import { en } from './en';
import { uk } from './uk';

interface Dictionary {
  [key: string]: string | Dictionary;
}

function flatten(dictionary: Dictionary, prefix = ''): [string, string][] {
  return Object.entries(dictionary).flatMap(([key, value]): [string, string][] => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? [[path, value]] : flatten(value, path);
  });
}

function placeholders(text: string) {
  const tokens = text.match(/\{\{[^}]+\}\}|<\/?[a-z0-9]+\s*\/?>/gi) ?? [];
  return [...new Set(tokens.map((token) => token.replace(/[\s/]/g, '')))]
    .sort()
    .join(' ');
}

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

const source = flatten(uk);

describe.each(Object.entries({ be, en }))('%s dictionary', (_locale, dictionary) => {
  const translated = new Map(flatten(dictionary));

  it('keeps the interpolations and tags of every uk message', () => {
    const mismatches = source.flatMap(([key, text]) => {
      const expected = placeholders(text);
      const actual = placeholders(translated.get(key) ?? '');
      return expected === actual ? [] : [`${key}: [${expected}] vs [${actual}]`];
    });
    expect(mismatches).toEqual([]);
  });

  it('has no empty message where uk has text', () => {
    const empty = source
      .filter(([key, text]) => text.trim() && !translated.get(key)?.trim())
      .map(([key]) => key);
    expect(empty).toEqual([]);
  });
});

describe.each(Object.entries({ uk, be, en }))('%s plurals', (locale, dictionary) => {
  it('have every form the locale tells apart', () => {
    const keys = new Set(flatten(dictionary).map(([key]) => key));
    const bases = new Set(
      [...keys]
        .filter((key) => PLURAL_SUFFIX.test(key))
        .map((key) => key.replace(PLURAL_SUFFIX, ''))
    );
    const missing = [...bases].flatMap((base) => {
      const type = base.endsWith('_ordinal') ? 'ordinal' : 'cardinal';
      return new Intl.PluralRules(locale, { type })
        .resolvedOptions()
        .pluralCategories.filter((form) => !keys.has(`${base}_${form}`))
        .map((form) => `${base}_${form}`);
    });
    expect(missing).toEqual([]);
  });
});
