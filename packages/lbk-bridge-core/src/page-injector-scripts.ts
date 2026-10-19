import { pageHintSource } from './achievement-page-hint';
import { PAGE_GLOBAL_KEY } from './achievement-page-url';

export const BINDING = '__lbkAchievementStrings';
const PAGE_GLOBAL = `globalThis[Symbol.for('${PAGE_GLOBAL_KEY}')]`;

// Runs in the page after the page module: forwards every app it waits for to the binding, read per call because a reconnect installs a new one.
const HOOKUP = `;(() => {
  const page = ${PAGE_GLOBAL};
  if (page && typeof page.onWanted === 'function') {
    page.onWanted((appid) => {
      const ask = globalThis.${BINDING};
      if (typeof ask === 'function') {
        ask(appid);
      }
    });
  }
})();
//# sourceURL=lbk-achievement-page.js`;

// Called with CDP arguments, so the strings reach the page as values and never as source text.
export const PROVIDE = `function (appid, strings) {
  const page = ${PAGE_GLOBAL};
  if (page && typeof page.provide === 'function') {
    page.provide(appid, strings);
  }
}`;

// What every document on the achievements sites runs first: the hint, the page module (IIFE), then the hookup.
export const documentSource = (script: string, hint: Iterable<string>): string =>
  `${pageHintSource(hint)}\n${script}\n${HOOKUP}`;
