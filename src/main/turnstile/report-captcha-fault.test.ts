import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Report from './report-captcha-fault';

const { captureMessage } = vi.hoisted(() => ({ captureMessage: vi.fn() }));

vi.mock('@sentry/electron/main', () => ({ captureMessage }));

let report: typeof Report;

beforeEach(async () => {
  captureMessage.mockReset();
  vi.resetModules();
  report = await import('./report-captcha-fault');
});

describe('reportCaptchaFault', () => {
  it('sends a cause once per run', () => {
    report.reportCaptchaFault('HTTP 404');
    report.reportCaptchaFault('HTTP 404');

    expect(captureMessage.mock.calls).toEqual([['Captcha page: HTTP 404', 'error']]);
  });

  it('sends each cause of its own', () => {
    report.reportCaptchaFault('HTTP 404');
    report.reportCaptchaFault('page reported script_error');

    expect(captureMessage).toHaveBeenCalledTimes(2);
  });
});
