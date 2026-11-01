import { MutationObserver, QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReviewAuthorIdentity } from '@/shared/game-reviews-types';
import { t } from '@/shared/i18n/i18n';
import type { FeedbackAttempt } from '../utils/feedbackAttempt';
import { flush } from './reviewActions.fixture';

const client = vi.hoisted(() => ({
  requestFeedbackUploadUrls: vi.fn(),
  sendFeedback: vi.fn(),
  prefetchReviewCaptcha: vi.fn(),
}));
const authors = vi.hoisted(() => ({
  ensureAuthor: vi.fn<() => Promise<ReviewAuthorIdentity | null>>(),
  forgetAuthor: vi.fn(),
}));
const trackEvent = vi.hoisted(() => vi.fn());

vi.mock('./reviewsClient', () => client);
vi.mock('../store/useReviewAuthorStore', () => ({
  useReviewAuthorStore: { getState: () => authors },
}));
vi.mock('../utils/analytics', () => ({ trackEvent }));

const { feedbackPostOptions, submitFeedbackPost } = await import('./submitFeedbackPost');

const POST = '3d2c1b0a-9f8e-4d7c-8b6a-5f4e3d2c1b0a';
const GAME = '0b6f3f0e-5c1a-4d2e-9f3b-2a1c4d5e6f70';
const OWL: ReviewAuthorIdentity = { name: 'Wise Owl', avatarSeed: 'owl' };
const NEEDS_AUTHOR = {
  ok: false,
  failure: { code: 'author_required', kind: 'needs-author' },
};
const fetchMock = vi.fn();

const SHOT = {
  name: 'a.png',
  file: new File(['x'], 'a.png', { type: 'image/png' }),
  type: 'image/png',
};

const first = (): FeedbackAttempt => ({
  id: POST,
  uploads: new Map(),
  unconfirmed: null,
});

const variables = (allowPublish: boolean) => ({
  entryId: POST,
  attempt: first(),
  post: {
    gameId: GAME,
    type: 'feedback' as const,
    message: 'Text',
    screenshots: [SHOT],
    allowPublish,
  },
});

const submit = (allowPublish: boolean) => submitFeedbackPost(variables(allowPublish));

const sentIds = () => client.sendFeedback.mock.calls.map(([input]) => input.id);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
  client.requestFeedbackUploadUrls.mockImplementation(
    ({ id, fileNames }: { id: string; fileNames: string[] }) =>
      Promise.resolve({
        ok: true,
        data: fileNames.map((name) => ({
          fileName: name,
          path: `${id}/${name}`,
          signedUrl: `https://upload/${name}`,
        })),
      })
  );
  client.sendFeedback.mockImplementation(({ id }: { id: string }) =>
    Promise.resolve({ ok: true, data: { id, outcome: 'pending' } })
  );
  authors.ensureAuthor.mockResolvedValue(OWL);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('submitFeedbackPost', () => {
  it('sends a private post without asking for a nickname', async () => {
    expect(await submit(false)).toMatchObject({ ok: true, outcome: 'pending' });

    expect(authors.ensureAuthor).not.toHaveBeenCalled();
  });

  it('gets the nickname for a public post before any screenshot uploads', async () => {
    expect(await submit(true)).toMatchObject({ ok: true, outcome: 'pending' });

    const [gate] = authors.ensureAuthor.mock.invocationCallOrder;
    const [upload] = client.requestFeedbackUploadUrls.mock.invocationCallOrder;
    expect(gate).toBeLessThan(upload);
  });

  it('sends and uploads nothing when the picker is closed', async () => {
    authors.ensureAuthor.mockResolvedValue(null);

    expect(await submit(true)).toBeNull();

    expect(client.requestFeedbackUploadUrls).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(client.sendFeedback).not.toHaveBeenCalled();
  });

  it('resends the same post once after author_required, with no second upload', async () => {
    client.sendFeedback.mockResolvedValueOnce(NEEDS_AUTHOR);

    expect(await submit(true)).toMatchObject({ ok: true, outcome: 'pending' });

    expect(authors.forgetAuthor).toHaveBeenCalledTimes(1);
    expect(client.prefetchReviewCaptcha).toHaveBeenCalledWith('review');
    expect(authors.ensureAuthor).toHaveBeenCalledTimes(2);
    expect(sentIds()).toEqual([POST, POST]);
    expect(client.requestFeedbackUploadUrls).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [forget] = authors.forgetAuthor.mock.invocationCallOrder;
    const [prefetch] = client.prefetchReviewCaptcha.mock.invocationCallOrder;
    const [, picker] = authors.ensureAuthor.mock.invocationCallOrder;
    expect(forget).toBeLessThan(prefetch);
    expect(prefetch).toBeLessThan(picker);
  });

  it.each([
    ['a rate limit', { ok: false, failure: { code: 'rate_limit', kind: 'retry' } }],
    ['a ban', { ok: false, failure: { code: 'banned', kind: 'rejected' } }],
    [
      'a failed captcha',
      { ok: false, failure: { code: 'captcha_failed', kind: 'retry' } },
    ],
  ])('hands back %s without the picker or a resend', async (_, refused) => {
    client.sendFeedback.mockResolvedValueOnce(refused);

    expect(await submit(true)).toMatchObject({ ok: false, failure: refused.failure });

    expect(authors.ensureAuthor).toHaveBeenCalledTimes(1);
    expect(authors.forgetAuthor).not.toHaveBeenCalled();
    expect(client.prefetchReviewCaptcha).not.toHaveBeenCalled();
    expect(sentIds()).toEqual([POST]);
  });

  it('hands back a failed screenshot upload without the picker or a send', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));

    expect(await submit(true)).toMatchObject({
      ok: false,
      message: t('feedbackModal.screenshotFailed', { name: SHOT.name }),
      failure: null,
    });

    expect(authors.ensureAuthor).toHaveBeenCalledTimes(1);
    expect(authors.forgetAuthor).not.toHaveBeenCalled();
    expect(client.prefetchReviewCaptcha).not.toHaveBeenCalled();
    expect(client.sendFeedback).not.toHaveBeenCalled();
  });

  it('stops after a second author_required', async () => {
    client.sendFeedback.mockResolvedValue(NEEDS_AUTHOR);

    expect(await submit(true)).toMatchObject({
      ok: false,
      message: t('feedbackModal.authorRequired'),
      failure: NEEDS_AUTHOR.failure,
    });

    expect(sentIds()).toEqual([POST, POST]);
    expect(authors.ensureAuthor).toHaveBeenCalledTimes(2);
  });

  it('keeps the refusal when the picker opened by author_required is closed', async () => {
    client.sendFeedback.mockResolvedValueOnce(NEEDS_AUTHOR);
    authors.ensureAuthor.mockResolvedValueOnce(OWL).mockResolvedValueOnce(null);

    expect(await submit(true)).toMatchObject({
      ok: false,
      message: t('feedbackModal.authorRequired'),
    });

    expect(sentIds()).toEqual([POST]);
  });
});

describe('feedbackPostOptions', () => {
  const run = async () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const observer = new MutationObserver(
      queryClient,
      feedbackPostOptions(queryClient, 'Game')
    );
    await observer.mutate(variables(false));
    await flush();
    return invalidate;
  };

  it('refetches the game reviews and tracks a sent post', async () => {
    const invalidate = await run();

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['game-reviews', GAME] });
    expect(trackEvent).toHaveBeenCalledWith(
      'Feedback Submitted',
      expect.objectContaining({ 'Game Id': GAME, Outcome: 'pending' })
    );
  });

  it('tracks a refused post without a refetch', async () => {
    client.sendFeedback.mockResolvedValueOnce({
      ok: false,
      failure: { code: 'rate_limit', kind: 'retry' },
    });

    const invalidate = await run();

    expect(invalidate).not.toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith('Feedback Rate Limited', { 'Game Id': GAME });
  });
});
