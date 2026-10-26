import * as Sentry from '@sentry/electron/main';

const reported = new Set<string>();

// initLogger replaces the console hook Sentry installs, so a fault that stops every public write is sent by hand, once per cause and run
export function reportCaptchaFault(cause: string): void {
  if (reported.has(cause)) {
    return;
  }
  reported.add(cause);
  Sentry.captureMessage(`Captcha page: ${cause}`, 'error');
}
