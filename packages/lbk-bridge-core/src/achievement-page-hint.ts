import { G } from '@mobily/ts-belt';
import { ACH_MAX_APPS } from './achievement-page-sources';
import { isAppId } from './achievement-page-url';

const HINT_KEY = 'lbk.achievementPageHint';

// Prepended to the page IIFE by a document-start host; the ids reach the page as JSON, never as raw text.
export function pageHintSource(appids: Iterable<string>): string {
  const list = [...new Set(appids)].filter(isAppId).sort().slice(0, ACH_MAX_APPS);
  return `Reflect.defineProperty(globalThis, Symbol.for(${JSON.stringify(HINT_KEY)}), { value: ${JSON.stringify(list)}, configurable: true });`;
}

// The IIFE entry takes it before any page script runs, so the page never sees which apps have strings.
export function takePageHint(win: object = globalThis): ReadonlySet<string> {
  const key = Symbol.for(HINT_KEY);
  const raw: unknown = Reflect.get(win, key);
  Reflect.deleteProperty(win, key);
  return new Set(G.isArray(raw) ? raw.filter(G.isString).filter(isAppId) : []);
}
