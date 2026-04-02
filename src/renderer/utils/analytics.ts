import mixpanel from 'mixpanel-browser';

export async function trackEvent(eventName: string, props?: Record<string, unknown>) {
  try {
    const isE2E = window.electronAPI?.isE2E?.() ?? false;
    if (typeof mixpanel?.track === 'function' && !import.meta.env.DEV && !isE2E) {
      mixpanel.track(eventName, props);
    }
  } catch (err) {
    console.error('[Analytics] trackEvent failed', err);
  }
}
