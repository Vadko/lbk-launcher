import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CAPTCHA_CHANNELS } from '../shared/captcha-channels';

type IpcHandler = (event: unknown, payload: unknown) => void;

interface CaptchaHost {
  onRequest: (listener: (request: unknown) => void) => () => void;
  ready: () => void;
  unavailable: (code: unknown) => void;
  resolve: (requestId: unknown, token: unknown) => void;
  reject: (requestId: unknown, code: unknown) => void;
}

const bridge = vi.hoisted(() => ({
  exposed: new Map<string, unknown>(),
  ipcRenderer: { on: vi.fn(), send: vi.fn(), removeListener: vi.fn() },
}));

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (name: string, api: unknown) => bridge.exposed.set(name, api),
  },
  ipcRenderer: bridge.ipcRenderer,
}));

await import('./turnstile');

const host = bridge.exposed.get('lbkCaptchaHost') as CaptchaHost;
const ID = '3d2c1b0a-9f8e-4d7c-8b6a-5f4e3d2c1b0a';

beforeEach(() => {
  bridge.ipcRenderer.on.mockClear();
  bridge.ipcRenderer.send.mockClear();
  bridge.ipcRenderer.removeListener.mockClear();
});

describe('captcha preload', () => {
  it('exposes only the five calls the captcha page makes', () => {
    expect([...bridge.exposed.keys()]).toEqual(['lbkCaptchaHost']);
    expect(Object.keys(host).sort()).toEqual([
      'onRequest',
      'ready',
      'reject',
      'resolve',
      'unavailable',
    ]);
    expect(Object.values(host).every((value) => typeof value === 'function')).toBe(true);
    expect(Object.values(host)).not.toContain(bridge.ipcRenderer);
  });

  it('hands the page a request without the IPC event', () => {
    const listener = vi.fn();
    host.onRequest(listener);
    const [[channel, handler]] = bridge.ipcRenderer.on.mock.calls as [
      [string, IpcHandler],
    ];
    const request = { requestId: ID, action: 'reply', cData: 'abc' };

    handler({ sender: 'ipc' }, request);

    expect(channel).toBe(CAPTCHA_CHANNELS.request);
    expect(listener.mock.calls).toEqual([[request]]);
  });

  it('stops listening when the page lets go', () => {
    const dispose = host.onRequest(vi.fn());
    const [[, handler]] = bridge.ipcRenderer.on.mock.calls as [[string, IpcHandler]];

    dispose();

    expect(bridge.ipcRenderer.removeListener).toHaveBeenCalledWith(
      CAPTCHA_CHANNELS.request,
      handler
    );
  });

  it.each<[string, () => void, unknown[]]>([
    ['ready', () => host.ready(), [CAPTCHA_CHANNELS.ready]],
    [
      'unavailable',
      () => host.unavailable('script_error'),
      [CAPTCHA_CHANNELS.unavailable, 'script_error'],
    ],
    [
      'resolve',
      () => host.resolve(ID, 'token-1'),
      [CAPTCHA_CHANNELS.resolve, ID, 'token-1'],
    ],
    ['reject', () => host.reject(ID, '300030'), [CAPTCHA_CHANNELS.reject, ID, '300030']],
  ])('sends %s to main', (_label, call, sent) => {
    call();

    expect(bridge.ipcRenderer.send.mock.calls).toEqual([sent]);
  });
});
