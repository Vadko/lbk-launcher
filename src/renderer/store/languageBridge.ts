import { changeLanguage, i18n } from '@/shared/i18n/i18n';
import { DEFAULT_LANGUAGE, type Language } from '@/shared/i18n/languages';
import { useSettingsStore } from './useSettingsStore';

// E2E finds its text by uk keys, so a language saved on the developer's machine must not apply.
const isE2E = window.electronAPI?.isE2E?.() ?? false;

function apply(language: Language): Promise<void> {
  return changeLanguage(isE2E ? DEFAULT_LANGUAGE : language)
    .catch((error: unknown) => {
      console.error('[Store] Failed to switch the language:', error);
    })
    .then(() => {
      document.documentElement.lang = i18n.language;
    });
}

export function initLanguage(): Promise<void> {
  useSettingsStore.subscribe((state, previous) => {
    if (state.language !== previous.language) {
      void apply(state.language);
    }
  });
  return apply(useSettingsStore.getState().language);
}
