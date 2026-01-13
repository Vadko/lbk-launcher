import mixpanel from 'mixpanel-browser';

export async function trackEvent(eventName: string, props?: Record<string, unknown>) {
  try {
    if (typeof mixpanel?.track === 'function' && !import.meta.env.DEV) {
      mixpanel.track(eventName, props);
    }
  } catch (err) {
    console.error('[Analytics] trackEvent failed', err);
  }
}
