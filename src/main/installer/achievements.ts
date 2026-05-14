/**
 * Live-inject translated achievement strings into Steam's UI without forcing
 * the user to restart Steam.
 *
 * Steam's UI never reads `Achievements.m_mapMyAchievements` raw — it goes
 * through getter methods on two stores. We `afterPatch` each getter so every
 * call returns a translated copy of whatever Steam computed. Architecturally
 * mirrors DeckAchievementsManager (which filters instead of translating).
 *
 * Patched getters:
 *   - `Achievements.GetMyAchievements(appId)` →
 *     `{ data: { achieved, unachieved, hidden } }` used by the achievements-
 *     page tabs.
 *   - `appDetailsStore.GetAchievements(appId)` →
 *     `{ vecHighlight, vecUnachieved, vecAchievedHidden }` used by the game
 *     details / library summary cards.
 *
 * References (verbatim ports / patterns we mirror):
 *   - `afterPatch`: decky-frontend-lib/src/utils/patcher.ts
 *   - webpack module cache + findModuleChild: decky-frontend-lib/src/webpack.ts
 *   - getter-patch strategy: ifantom/DeckAchievementsManager/src/patches/...
 */

import { extractAchievementTranslationsFromFile } from '@/main/utils/extract-achievement-translations';
import { evaluateInSharedJsContext, isCefAvailable } from '@/main/utils/steam-cef';

/**
 * Build the JS expression we hand to CEF's `Runtime.evaluate`. Everything
 * inside the template literal runs inside Steam's SharedJSContext.
 *
 * Per-game translations are stashed on `window.__lbk_achievementTranslations`
 * so a second install (different game) just adds an entry; the patches
 * themselves are installed once and consult the map by appId.
 */
function buildAchievementInjectionExpression(
  appId: number,
  translations: Record<string, { strName: string; strDescription: string }>
): string {
  return `(() => {
    const APP_ID = ${appId};
    const TR = ${JSON.stringify(translations)};

    const store = (window.__lbk_achievementTranslations ||= {});
    store[APP_ID] = TR;

    // ---- afterPatch — verbatim port from decky-frontend-lib/utils/patcher.ts ----
    const afterPatch = (object, property, handler) => {
      const orig = object[property];
      object[property] = function (...args) {
        let ret = orig.call(this, ...args);
        ret = handler.call(this, args, ret);
        return ret;
      };
      // Preserve toString so any webpack filters keyed on it keep working.
      object[property].toString = () => orig.toString();
      object[property].__lbkOrig = orig;
    };

    // ---- Translation helpers ----
    const translateAch = (ach, tr) => {
      const t = tr[ach?.strID];
      return t ? { ...ach, strName: t.strName, strDescription: t.strDescription } : ach;
    };

    // Achievements.GetMyAchievements result shape: { data: { achieved, unachieved, hidden } }
    const translateBuckets = (data, tr) => {
      if (!data) return data;
      const out = { ...data };
      for (const bucket of ['achieved', 'unachieved', 'hidden']) {
        const src = data[bucket];
        if (!src) continue;
        const cloned = {};
        for (const id of Object.keys(src)) cloned[id] = translateAch(src[id], tr);
        out[bucket] = cloned;
      }
      return out;
    };

    // appDetailsStore.GetAchievements result shape: { vecHighlight, vecUnachieved, vecAchievedHidden }
    const translateVecs = (result, tr) => {
      if (!result) return result;
      const mapVec = (v) => Array.isArray(v) ? v.map((a) => translateAch(a, tr)) : v;
      return {
        ...result,
        vecAchievedHidden: mapVec(result.vecAchievedHidden),
        vecHighlight: mapVec(result.vecHighlight),
        vecUnachieved: mapVec(result.vecUnachieved),
      };
    };

    if (window.__lbk_achievementPatchInstalled) {
      // Patches already in place; trigger Steam to reload data for this app so
      // the next render hits our patched getters with fresh strings.
      window.__lbk_achievementModule?.LoadMyAchievements?.(APP_ID);
      return { mode: 'refresh' };
    }

    // ---- decky-frontend-lib webpack module cache (verbatim port) ----
    if (!window.__lbk_webpackModules) {
      const cache = new Map();
      const id = Symbol('@lbk/ui');
      let webpackRequire;
      window.webpackChunksteamui.push([
        [id],
        {},
        (r) => {
          webpackRequire = r;
        },
      ]);
      for (const moduleId of Object.keys(webpackRequire.m)) {
        try {
          const mod = webpackRequire(moduleId);
          if (mod) cache.set(moduleId, mod);
        } catch {
          // Module side-effect threw; safe to skip — Decky does the same.
        }
      }
      window.__lbk_webpackModules = cache;
    }

    const findModuleChild = (filter) => {
      for (const m of window.__lbk_webpackModules.values()) {
        for (const candidate of [m?.default, m]) {
          if (!candidate) continue;
          const hit = filter(candidate);
          if (hit) return hit;
        }
      }
      return null;
    };

    // ---- Locate the Achievements module (the one carrying m_mapMyAchievements) ----
    const achModule = findModuleChild((module) => {
      if (typeof module !== 'object' || module === null) return undefined;
      for (const prop in module) {
        if (module[prop]?.m_mapMyAchievements) return module[prop];
      }
      return undefined;
    });
    if (!achModule) throw new Error('Achievements module not found');
    window.__lbk_achievementModule = achModule;

    // ---- Patch 1: Achievements.GetMyAchievements (achievements-page tabs) ----
    afterPatch(Object.getPrototypeOf(achModule), 'GetMyAchievements', function ([loadedAppId], result) {
      const tr = (window.__lbk_achievementTranslations || {})[loadedAppId];
      if (!tr || !result?.data) return result;
      return { ...result, data: translateBuckets(result.data, tr) };
    });

    // ---- Patch 2: appDetailsStore.GetAchievements (library / details summary) ----
    if (typeof appDetailsStore !== 'undefined' && appDetailsStore?.__proto__?.GetAchievements) {
      afterPatch(appDetailsStore.__proto__, 'GetAchievements', function ([loadedAppId], result) {
        const tr = (window.__lbk_achievementTranslations || {})[loadedAppId];
        if (!tr) return result;
        return translateVecs(result, tr);
      });
    }

    window.__lbk_achievementPatchInstalled = true;

    // Force Steam to reload so the patched getters are exercised immediately.
    achModule.LoadMyAchievements(APP_ID);
    return { mode: 'installed' };
  })()`;
}

/**
 * Read translations from the freshly-written schema file and CEF-inject if
 * Steam is reachable. The `.bin` on disk is the persistent source-of-truth
 * either way — Steam reads it at next startup regardless. This just avoids
 * the "restart Steam to see new names" round-trip while Steam is up.
 */
export async function applyAchievementsLive(
  appId: number,
  schemaPath: string
): Promise<void> {
  try {
    const translations = extractAchievementTranslationsFromFile(schemaPath);
    const count = Object.keys(translations).length;
    if (count === 0) {
      console.log(`[Installer] No achievement translations found in ${schemaPath}`);
      return;
    }
    if (await isCefAvailable()) {
      await evaluateInSharedJsContext(
        buildAchievementInjectionExpression(appId, translations)
      );
      console.log(
        `[Installer] Applied ${count} achievement translation(s) via CEF for ${appId}`
      );
      return;
    }
    console.log(
      `[Installer] ${count} achievement translation(s) on disk for ${appId}; Steam will pick them up on next start`
    );
  } catch (err) {
    console.warn(
      '[Installer] Achievement live-apply failed:',
      err instanceof Error ? err.message : err
    );
  }
}
