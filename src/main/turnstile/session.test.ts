import { describe, expect, it, vi } from 'vitest';

type RequestHandler = (contents: unknown, permission: string, callback: Grant) => void;
type Grant = (granted: boolean) => void;
type DownloadHandler = (event: { preventDefault: () => void }) => void;

const fake = vi.hoisted(() => ({
  fromPartition: vi.fn(),
  request: null as RequestHandler | null,
  check: null as (() => boolean) | null,
  device: null as (() => boolean) | null,
  download: null as DownloadHandler | null,
}));

vi.mock('electron', () => ({
  session: {
    fromPartition: fake.fromPartition.mockImplementation(() => ({
      setPermissionRequestHandler: (handler: RequestHandler) => {
        fake.request = handler;
      },
      setPermissionCheckHandler: (handler: () => boolean) => {
        fake.check = handler;
      },
      setDevicePermissionHandler: (handler: () => boolean) => {
        fake.device = handler;
      },
      on: (event: string, handler: DownloadHandler) => {
        if (event === 'will-download') {
          fake.download = handler;
        }
      },
    })),
  },
}));

const { captchaSession } = await import('./session');

describe('captchaSession', () => {
  it('lives in memory and is made once', () => {
    expect(captchaSession()).toBe(captchaSession());
    expect(fake.fromPartition).toHaveBeenCalledTimes(1);
    expect(fake.fromPartition.mock.calls[0]?.[0]).not.toMatch(/^persist:/);
  });

  it.each(['media', 'geolocation', 'notifications', 'clipboard-read'])(
    'refuses a %s request',
    (permission) => {
      captchaSession();
      const grant = vi.fn<Grant>();

      fake.request?.(null, permission, grant);

      expect(grant).toHaveBeenCalledWith(false);
    }
  );

  it('answers every permission and device check with no', () => {
    captchaSession();

    expect(fake.check?.()).toBe(false);
    expect(fake.device?.()).toBe(false);
  });

  it('cancels every download the page starts', () => {
    captchaSession();
    const event = { preventDefault: vi.fn() };

    fake.download?.(event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });
});
