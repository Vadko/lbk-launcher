const RULES = new Intl.PluralRules('uk-UA');

export function plural(count: number, one: string, few: string, many: string): string {
  switch (RULES.select(count)) {
    case 'one':
      return one;
    case 'few':
      return few;
    case 'other':
      return few;
    default:
      return many;
  }
}
