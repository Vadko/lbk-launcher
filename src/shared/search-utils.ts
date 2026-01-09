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

export function getSearchVariations(input: string): string[] {
  if (!input) return [];

  const normalized = input.toLowerCase();
  const translit = getTransliteration(input);

  return translit ? [normalized, translit] : [normalized];
}
