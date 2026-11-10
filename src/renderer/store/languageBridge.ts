import { setLanguage } from '@/shared/i18n/i18n';
import { DEFAULT_LANGUAGE, isLanguage } from '@/shared/i18n/languages';
import { useSettingsStore } from './useSettingsStore';

function apply(language: unknown): void {
  const supported = isLanguage(language) ? language : DEFAULT_LANGUAGE;
  setLanguage(supported);
  document.documentElement.lang = supported;
}

export function initLanguage(): void {
  apply(useSettingsStore.getState().language);
  useSettingsStore.subscribe((state, previous) => {
    if (state.language !== previous.language) {
      apply(state.language);
    }
  });
}
