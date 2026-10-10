import mixpanel from 'mixpanel-browser';
import { useSettingsStore } from '../store/useSettingsStore';

const hasToken = Boolean(
  import.meta.env.DEV
    ? import.meta.env.VITE_MIXPANEL_TOKEN_DEV
    : import.meta.env.VITE_MIXPANEL_TOKEN_PROD
);

export function trackEvent(eventName: string, props?: Record<string, unknown>) {
  try {
    const isE2E = window.electronAPI?.isE2E?.() ?? false;
    if (
      typeof mixpanel?.track === 'function' &&
      hasToken &&
      !isE2E &&
      useSettingsStore.getState().productAnalyticsEnabled
    ) {
      mixpanel.track(eventName, props);
    }
  } catch (err) {
    console.error('[Analytics] trackEvent failed', err);
  }
}
