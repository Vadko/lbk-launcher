import CyrillicToTranslit from 'cyrillic-to-translit-js';

const translitUk = CyrillicToTranslit({ preset: 'uk' });

function getTransliteration(input: string): string | null {
  const hasCyrillic = /[а-яіїєґА-ЯІЇЄҐ]/.test(input);
  const hasLatin = /[a-zA-Z]/.test(input);

  if (hasCyrillic) {
    const translit = translitUk.transform(input);
    if (translit && translit !== input) {
      return translit.toLowerCase();
    }
  }

  if (hasLatin) {
    const reverse = translitUk.reverse(input);
    if (reverse && reverse !== input) {
      return reverse.toLowerCase();
    }
  }

  return null;
}

export function generateSearchableString(name: string): string {
  const nameLower = name.toLowerCase();
  const translit = getTransliteration(name);

  return translit ? `${nameLower} ${translit}` : nameLower;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 2);
}

function escapeFtsToken(token: string): string {
  return token.replace(/"/g, '""');
}

export function buildFtsQuery(input: string): string {
  if (!input) {
    return '';
  }

  const buildExpr = (tokens: string[]) =>
    tokens.map((t) => `"${escapeFtsToken(t)}"*`).join(' AND ');

  const primary = tokenize(input);
  const translit = getTransliteration(input);
  const translitTokens = translit ? tokenize(translit) : [];

  const exprs: string[] = [];
  if (primary.length) {
    exprs.push(`(${buildExpr(primary)})`);
  }
  if (translitTokens.length) {
    exprs.push(`(${buildExpr(translitTokens)})`);
  }

  return exprs.join(' OR ');
}

export function teamToSlug(team: string): string {
  return translitUk
    .transform(team)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
