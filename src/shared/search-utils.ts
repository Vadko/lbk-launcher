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

export function stripApostrophes(value: string): string {
  return value.replace(/['’ʼ‘ʻʹ′＇`´]/g, '');
}

export function withStrippedVariant(value: string): string {
  const stripped = stripApostrophes(value);
  return stripped === value ? value : `${value} ${stripped}`;
}

export function generateSearchableString(name: string): string {
  const nameLower = name.toLowerCase();
  const translit = getTransliteration(name);

  return withStrippedVariant(translit ? `${nameLower} ${translit}` : nameLower);
}

function tokenize(value: string, keepNumbers: boolean): string[] {
  const parts = value.toLowerCase().split(/[^\p{L}\p{N}]+/u);
  const words = parts.filter((t) => t.length >= 2);
  // A lone number would match every title containing it ('S.T.A.L.K.E.R. 2' → "2"*)
  if (!keepNumbers || words.length === 0) {
    return words;
  }
  return parts.filter((t) => t.length >= 2 || /^\p{N}+$/u.test(t));
}

function escapeFtsToken(token: string): string {
  return token.replace(/"/g, '""');
}

function buildFtsQuery(input: string, keepNumbers: boolean): string {
  if (!input) {
    return '';
  }

  const buildExpr = (tokens: string[]) =>
    tokens.map((t) => `"${escapeFtsToken(t)}"*`).join(' AND ');

  // The index is apostrophe-free, so the primary form is too. But we keep the
  // raw variant in OR: otherwise "heaven's" would stop matching "Heavenly Sword",
  // because the "s" would stick to the word and break the prefix match.
  const translit = getTransliteration(input);
  const sources = [stripApostrophes(input), input];
  if (translit) {
    sources.push(stripApostrophes(translit), translit);
  }

  const exprs: string[] = [];
  const seen = new Set<string>();
  for (const source of sources) {
    const tokens = tokenize(source, keepNumbers);
    if (!tokens.length) {
      continue;
    }
    const expr = `(${buildExpr(tokens)})`;
    if (!seen.has(expr)) {
      seen.add(expr);
      exprs.push(expr);
    }
  }

  return exprs.join(' OR ');
}

export function buildFtsQueries(input: string): string[] {
  const queries = [buildFtsQuery(input, true), buildFtsQuery(input, false)];
  return [...new Set(queries)].filter(Boolean);
}

export function teamToSlug(team: string): string {
  return translitUk
    .transform(team)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
