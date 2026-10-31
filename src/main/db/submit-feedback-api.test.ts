import { beforeEach, describe, expect, it, vi } from 'vitest';
import { answered, invokeCalls, MACHINE_ID, refused } from './review-functions.fixture';

const { invoke, takeCaptchaToken } = vi.hoisted(() => ({
  invoke: vi.fn(),
  takeCaptchaToken: vi.fn(),
}));

vi.mock('electron', () => ({ app: { getVersion: () => '2.24.0' } }));
vi.mock('@/main/utils/os-version', () => ({ getOsVersion: () => 'Test OS 1' }));
vi.mock('@/main/db/supabase-client', () => ({
  getSupabaseClient: () => ({ functions: { invoke } }),
}));
vi.mock('@/main/tracking', () => ({ IS_E2E: false, getMachineId: () => 'machine-1' }));
vi.mock('@/main/turnstile/tokens', () => ({ takeCaptchaToken }));

const { getFeedbackUploadUrls, submitFeedback } = await import('./submit-feedback-api');

const POST = '3d2c1b0a-9f8e-4d7c-8b6a-5f4e3d2c1b0a';
const GAME = '0b6f3f0e-5c1a-4d2e-9f3b-2a1c4d5e6f70';

const post = (screenshotPaths: string[], allowPublish = false) => ({
  id: POST,
  gameId: GAME,
  type: 'error' as const,
  message: 'The menu is in English',
  screenshotPaths,
  allowPublish,
});

const sentBody = () => invokeCalls(invoke.mock.calls)[0]?.body;

beforeEach(() => {
  invoke.mockReset();
  takeCaptchaToken.mockReset();
  takeCaptchaToken.mockResolvedValue('token-1');
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('submitFeedback', () => {
  it('posts under the client id with the build and system details', async () => {
    invoke.mockResolvedValue(answered({ id: POST, outcome: 'published' }));

    const result = await submitFeedback(post([`${POST}/shot.png`]));

    expect(result).toEqual({ ok: true, data: { id: POST, outcome: 'published' } });
    expect(invokeCalls(invoke.mock.calls)[0]).toEqual({
      name: 'submit-feedback',
      body: {
        id: POST,
        gameId: GAME,
        type: 'error',
        message: 'The menu is in English',
        screenshotPaths: [`${POST}/shot.png`],
        version: '2.24.0',
        platform: process.platform,
        arch: process.arch,
        osVersion: 'Test OS 1',
        machineId: MACHINE_ID,
      },
      timeout: 30_000,
    });
  });

  it('leaves the screenshots out when there are none', async () => {
    invoke.mockResolvedValue(answered({ id: POST, outcome: 'published' }));

    await submitFeedback(post([]));

    expect(sentBody()).not.toHaveProperty('screenshotPaths');
  });

  it('asks for no publication and no token for a private post', async () => {
    invoke.mockResolvedValue(answered({ id: POST, outcome: 'published' }));

    await submitFeedback(post([]));

    expect(sentBody()).not.toHaveProperty('allowPublish');
    expect(sentBody()).not.toHaveProperty('captchaToken');
    expect(takeCaptchaToken).not.toHaveBeenCalled();
  });

  it('asks for publication with a review token', async () => {
    invoke.mockResolvedValue(answered({ id: POST, outcome: 'pending' }));

    await submitFeedback(post([], true));

    expect(takeCaptchaToken).toHaveBeenCalledWith('review');
    expect(sentBody()).toMatchObject({ allowPublish: true, captchaToken: 'token-1' });
  });

  it('confirms a stored public post without a token', async () => {
    takeCaptchaToken.mockResolvedValue(null);
    invoke.mockResolvedValue(answered({ id: POST, outcome: 'pending' }));

    expect(await submitFeedback(post([], true))).toEqual({
      ok: true,
      data: { id: POST, outcome: 'pending' },
    });
    expect(sentBody()).toMatchObject({ id: POST, allowPublish: true });
    expect(sentBody()).not.toHaveProperty('captchaToken');
  });

  it('reads a new public post refused for want of a token as captcha_unavailable', async () => {
    takeCaptchaToken.mockResolvedValue(null);
    invoke.mockResolvedValue(refused('captcha_failed', 403));

    expect(await submitFeedback(post([], true))).toEqual({
      ok: false,
      failure: { code: 'captcha_unavailable', kind: 'retry' },
    });
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});

describe('getFeedbackUploadUrls', () => {
  it('asks for paths under the post id and keeps what the upload needs', async () => {
    invoke.mockResolvedValue(
      answered({
        uploadUrls: [
          {
            fileName: 'shot.png',
            path: `${POST}/a.png`,
            signedUrl: 'https://upload/a',
            token: 't',
          },
        ],
      })
    );

    const result = await getFeedbackUploadUrls({ id: POST, fileNames: ['shot.png'] });

    expect(result).toEqual({
      ok: true,
      data: [
        { fileName: 'shot.png', path: `${POST}/a.png`, signedUrl: 'https://upload/a' },
      ],
    });
    expect(invokeCalls(invoke.mock.calls)[0]).toEqual({
      name: 'submit-feedback?action=upload-urls',
      body: { id: POST, fileNames: ['shot.png'], machineId: MACHINE_ID },
      timeout: 15_000,
    });
  });
});
