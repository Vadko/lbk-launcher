import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { reportCaptchaFault } = vi.hoisted(() => ({ reportCaptchaFault: vi.fn() }));

vi.mock('@/main/turnstile/report-captcha-fault', () => ({ reportCaptchaFault }));

async function loadReader() {
  vi.resetModules();
  return (await import('./page-url')).captchaPageUrl;
}

beforeEach(() => {
  reportCaptchaFault.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('captchaPageUrl', () => {
  it('reads the https address from the build', async () => {
    vi.stubEnv('VITE_CAPTCHA_PAGE_URL', 'https://lbklauncher.com/captcha');

    expect((await loadReader())()?.href).toBe('https://lbklauncher.com/captcha');
    expect(reportCaptchaFault).not.toHaveBeenCalled();
  });

  it.each([
    ['a missing address', ''],
    ['an address without a scheme', 'lbklauncher.com/captcha'],
    ['plain http', 'http://lbklauncher.com/captcha'],
  ])('gives null for %s and reports it once', async (_label, value) => {
    vi.stubEnv('VITE_CAPTCHA_PAGE_URL', value);
    const read = await loadReader();

    expect(read()).toBeNull();
    expect(read()).toBeNull();
    expect(reportCaptchaFault).toHaveBeenCalledTimes(1);
  });
});
