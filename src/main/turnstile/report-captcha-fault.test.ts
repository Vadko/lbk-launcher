import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Report from './report-captcha-fault';

const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

let report: typeof Report;

beforeEach(async () => {
  vi.resetModules();
  report = await import('./report-captcha-fault');
});

afterEach(() => {
  error.mockClear();
  warn.mockClear();
});

describe('reportCaptchaFault', () => {
  it('logs a cause as an error once per run, then as a warning', () => {
    report.reportCaptchaFault('HTTP 404');
    report.reportCaptchaFault('HTTP 404');

    expect(error.mock.calls).toEqual([['[Turnstile] Captcha page: HTTP 404']]);
    expect(warn.mock.calls).toEqual([['[Turnstile] Captcha page: HTTP 404']]);
  });

  it('logs each cause as an error of its own', () => {
    report.reportCaptchaFault('HTTP 404');
    report.reportCaptchaFault('page reported script_error');

    expect(error).toHaveBeenCalledTimes(2);
    expect(warn).not.toHaveBeenCalled();
  });
});
