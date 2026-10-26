import { F } from '@mobily/ts-belt';
import { reportCaptchaFault } from './report-captcha-fault';

// Read once, so a build without the address reports it a single time
export const captchaPageUrl = F.once((): URL | null => {
  const raw = import.meta.env.VITE_CAPTCHA_PAGE_URL;
  const url = raw && URL.canParse(raw) ? new URL(raw) : null;
  if (url?.protocol === 'https:') {
    return url;
  }
  console.error('[Turnstile] VITE_CAPTCHA_PAGE_URL is missing or not https');
  reportCaptchaFault('VITE_CAPTCHA_PAGE_URL is missing or not https');
  return null;
});
