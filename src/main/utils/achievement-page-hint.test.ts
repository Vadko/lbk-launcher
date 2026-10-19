import vm from 'node:vm';
import { pageHintSource, takePageHint } from '@lbk/bridge-core/achievement-page-hint';
import { ACH_MAX_APPS } from '@lbk/bridge-core/achievement-page-sources';
import { describe, expect, it } from 'vitest';

const HINT = Symbol.for('lbk.achievementPageHint');

// Runs the hint source the way a document-start script does, then takes it like the IIFE entry.
function roundTrip(appids: string[]): { taken: string[]; left: unknown } {
  const page = vm.createContext({});
  vm.runInContext(pageHintSource(appids), page);
  const taken = [...takePageHint(page)];
  return { taken, left: Reflect.get(page, HINT) };
}

describe('achievement page hint', () => {
  it('hands the apps to the page module once and leaves nothing on the page', () => {
    expect(roundTrip(['620', '400'])).toEqual({ taken: ['400', '620'], left: undefined });
  });

  it.each([
    ['script text', '"]);alert(1);//'],
    ['a closing script tag', '620</script>'],
    ['a leading zero', '0620'],
    ['eleven digits', '12345678901'],
    ['a duplicate', '620'],
  ])('drops %s', (_label, appid) => {
    expect(roundTrip(['620', appid]).taken).toEqual(['620']);
  });

  it(`stops at ${ACH_MAX_APPS} apps`, () => {
    const appids = Array.from({ length: ACH_MAX_APPS + 10 }, (_, i) => String(i + 1));
    expect(roundTrip(appids).taken).toHaveLength(ACH_MAX_APPS);
  });

  it.each<[string, unknown]>([
    ['nothing', undefined],
    ['an object', { 620: true }],
    ['numbers', [620]],
    ['a string', '620'],
  ])('reads %s on the page as no hint', (_label, value) => {
    const page = {};
    Reflect.defineProperty(page, HINT, { value, configurable: true });
    expect([...takePageHint(page)]).toEqual([]);
    expect(Reflect.get(page, HINT)).toBe(undefined);
  });
});
