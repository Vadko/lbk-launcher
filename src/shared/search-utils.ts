import CyrillicToTranslit from 'cyrillic-to-translit-js';

const translitUk = CyrillicToTranslit({preset: 'uk'});

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

  // Індекс без апострофів, тому основна форма — теж без них. Але сирий варіант
  // лишаємо в OR: інакше «heaven's» перестане ловити «Heavenly Sword», бо «s»
  // приклеїться до слова й зламає префіксний матч.
  const translit = getTransliteration(input);
  const sources = [stripApostrophes(input), input];
  if (translit) {
    sources.push(stripApostrophes(translit), translit);
  }

  const exprs: string[] = [];
  const seen = new Set<string>();
  for (const source of sources) {
    const tokens = tokenize(source);
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

export function teamToSlug(team: string): string {
  return translitUk
  .transform(team)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');
}
