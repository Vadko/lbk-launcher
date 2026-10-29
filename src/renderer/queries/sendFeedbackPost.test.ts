import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/shared/i18n/i18n';
import type { FeedbackAttempt } from '../utils/feedbackAttempt';

const client = vi.hoisted(() => ({
  requestFeedbackUploadUrls: vi.fn(),
  sendFeedback: vi.fn(),
}));

vi.mock('./reviewsClient', () => client);

const { sendFeedbackPost } = await import('./sendFeedbackPost');

const POST = '3d2c1b0a-9f8e-4d7c-8b6a-5f4e3d2c1b0a';
const GAME = '0b6f3f0e-5c1a-4d2e-9f3b-2a1c4d5e6f70';
const fetchMock = vi.fn();

const shot = (name: string) => ({
  name,
  file: new File(['x'], name, { type: 'image/png' }),
  type: 'image/png',
});

const SHOT_A = shot('a.png');
const SHOT_B = shot('b.png');

const post = (screenshots = [SHOT_A, SHOT_B], message = 'The menu is in English') => ({
  gameId: GAME,
  type: 'error' as const,
  message,
  screenshots,
  allowPublish: false,
});

const first = (): FeedbackAttempt => ({
  id: POST,
  uploads: new Map(),
  unconfirmed: null,
});

const target = (id: string, name: string) => ({
  fileName: name,
  path: `${id}/${name}`,
  signedUrl: `https://upload/${name}`,
});

const refusal = (code: string, kind: string) => ({ ok: false, failure: { code, kind } });

const sentIds = () => client.sendFeedback.mock.calls.map(([input]) => input.id);

beforeEach(() => {
  client.requestFeedbackUploadUrls.mockReset();
  client.sendFeedback.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  client.requestFeedbackUploadUrls.mockImplementation(
    ({ id, fileNames }: { id: string; fileNames: string[] }) =>
      Promise.resolve({ ok: true, data: fileNames.map((name) => target(id, name)) })
  );
  client.sendFeedback.mockResolvedValue({
    ok: true,
    data: { id: POST, outcome: 'published' },
  });
  fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sendFeedbackPost', () => {
  it('uploads every screenshot under the post id, then sends their paths', async () => {
    const result = await sendFeedbackPost(first(), post());

    expect(result).toMatchObject({ ok: true, outcome: 'published' });
    expect(client.requestFeedbackUploadUrls).toHaveBeenCalledWith({
      id: POST,
      fileNames: ['a.png', 'b.png'],
    });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://upload/a.png',
      'https://upload/b.png',
    ]);
    expect(client.sendFeedback).toHaveBeenCalledWith({
      id: POST,
      gameId: GAME,
      type: 'error',
      message: 'The menu is in English',
      screenshotPaths: [`${POST}/a.png`, `${POST}/b.png`],
      allowPublish: false,
    });
  });

  it('asks for no upload without screenshots', async () => {
    expect((await sendFeedbackPost(first(), post([]))).ok).toBe(true);
    expect(client.requestFeedbackUploadUrls).not.toHaveBeenCalled();
    expect(client.sendFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ screenshotPaths: [] })
    );
  });

  it('passes the choice to publish on to main', async () => {
    await sendFeedbackPost(first(), { ...post([]), allowPublish: true });

    expect(client.sendFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ allowPublish: true })
    );
  });

  it('stops before sending when the upload urls are refused', async () => {
    const failure = { code: 'internal', kind: 'retry' };
    client.requestFeedbackUploadUrls.mockResolvedValue({ ok: false, failure });

    expect(await sendFeedbackPost(first(), post())).toEqual({
      ok: false,
      message: t('feedbackModal.screenshotsFailed'),
      failure,
      attempt: first(),
    });
    expect(client.sendFeedback).not.toHaveBeenCalled();
  });

  it.each([
    [
      'a refused upload',
      () => fetchMock.mockResolvedValueOnce(new Response(null, { status: 403 })),
    ],
    ['a network error', () => fetchMock.mockRejectedValueOnce(new TypeError('offline'))],
    [
      'a missing upload url',
      () => client.requestFeedbackUploadUrls.mockResolvedValue({ ok: true, data: [] }),
    ],
  ])('names the screenshot that failed on %s', async (_label, arrange) => {
    arrange();

    expect(await sendFeedbackPost(first(), post())).toMatchObject({
      ok: false,
      message: t('feedbackModal.screenshotFailed', { name: 'a.png' }),
      failure: null,
    });
    expect(client.sendFeedback).not.toHaveBeenCalled();
  });

  it.each(['published', 'pending', 'removed'] as const)(
    'hands back the server outcome %s',
    async (outcome) => {
      client.sendFeedback.mockResolvedValue({ ok: true, data: { id: POST, outcome } });

      expect(await sendFeedbackPost(first(), post([]))).toMatchObject({
        ok: true,
        outcome,
      });
    }
  );

  it.each([
    ['rate_limit', 'retry', false, 'feedbackModal.rateLimit'],
    ['unreachable', 'retry', false, 'feedbackModal.networkError'],
    ['captcha_failed', 'retry', true, 'feedbackModal.captchaFailed'],
    ['not_found', 'rejected', true, 'feedbackModal.gameUnavailable'],
    ['not_found', 'rejected', false, 'feedbackModal.gameRemoved'],
  ] as const)(
    'explains a refused %s post (public: %s)',
    async (code, kind, allowPublish, key) => {
      client.sendFeedback.mockResolvedValue(refusal(code, kind));

      expect(
        await sendFeedbackPost(first(), { ...post([]), allowPublish })
      ).toMatchObject({
        ok: false,
        message: t(key),
        failure: { code, kind },
      });
    }
  );

  it('resends the same post without uploading its screenshots again', async () => {
    client.sendFeedback.mockResolvedValueOnce(refusal('rate_limit', 'retry'));

    const failed = await sendFeedbackPost(first(), post());
    const resent = await sendFeedbackPost(failed.attempt, post());

    expect(resent.ok).toBe(true);
    expect(client.requestFeedbackUploadUrls).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(client.sendFeedback.mock.calls.map(([input]) => input)).toEqual([
      expect.objectContaining({
        id: POST,
        screenshotPaths: [`${POST}/a.png`, `${POST}/b.png`],
      }),
      expect.objectContaining({
        id: POST,
        screenshotPaths: [`${POST}/a.png`, `${POST}/b.png`],
      }),
    ]);
  });

  it('uploads only the screenshots a failed attempt did not', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }));

    const failed = await sendFeedbackPost(first(), post());
    await sendFeedbackPost(failed.attempt, post());

    expect(client.requestFeedbackUploadUrls.mock.calls.map(([input]) => input)).toEqual([
      { id: POST, fileNames: ['a.png', 'b.png'] },
      { id: POST, fileNames: ['b.png'] },
    ]);
  });

  it('keeps the id for changed content once the server answered that it stored nothing', async () => {
    client.sendFeedback.mockResolvedValueOnce(refusal('rate_limit', 'retry'));

    const failed = await sendFeedbackPost(first(), post());
    await sendFeedbackPost(failed.attempt, post([SHOT_A], 'Fixed text'));

    expect(sentIds()).toEqual([POST, POST]);
  });

  it.each([['unreachable'], ['bad_response'], ['internal']])(
    'sends changed content under a new id after %s, since the first may be stored',
    async (code) => {
      client.sendFeedback.mockResolvedValueOnce(refusal(code, 'retry'));

      const failed = await sendFeedbackPost(first(), post());
      const changed = await sendFeedbackPost(
        failed.attempt,
        post([SHOT_A], 'Fixed text')
      );

      const [, second] = sentIds();
      expect(second).not.toBe(POST);
      expect(changed.attempt.id).toBe(second);
      expect(client.sendFeedback).toHaveBeenLastCalledWith(
        expect.objectContaining({ screenshotPaths: [`${second}/a.png`] })
      );
    }
  );

  it('resends unchanged content under the same id after a lost answer', async () => {
    client.sendFeedback.mockResolvedValueOnce(refusal('unreachable', 'retry'));

    const failed = await sendFeedbackPost(first(), post());
    await sendFeedbackPost(failed.attempt, post());

    expect(sentIds()).toEqual([POST, POST]);
    expect(client.requestFeedbackUploadUrls).toHaveBeenCalledTimes(1);
  });
});
