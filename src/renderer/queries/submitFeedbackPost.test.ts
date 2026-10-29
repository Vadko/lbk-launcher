import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReviewAuthorIdentity } from '@/shared/game-reviews-types';
import { t } from '@/shared/i18n/i18n';
import type { FeedbackAttempt } from '../utils/feedbackAttempt';
import type { FeedbackPostResult } from './sendFeedbackPost';

const client = vi.hoisted(() => ({
  requestFeedbackUploadUrls: vi.fn(),
  sendFeedback: vi.fn(),
  prefetchReviewCaptcha: vi.fn(),
}));
const authors = vi.hoisted(() => ({
  ensureAuthor: vi.fn<(signal?: AbortSignal) => Promise<ReviewAuthorIdentity | null>>(),
  forgetAuthor: vi.fn(),
}));

vi.mock('./reviewsClient', () => client);
vi.mock('../store/useReviewAuthorStore', () => ({
  useReviewAuthorStore: { getState: () => authors },
}));

const { submitFeedbackPost } = await import('./submitFeedbackPost');

const POST = '3d2c1b0a-9f8e-4d7c-8b6a-5f4e3d2c1b0a';
const GAME = '0b6f3f0e-5c1a-4d2e-9f3b-2a1c4d5e6f70';
const OWL: ReviewAuthorIdentity = { name: 'Wise Owl', avatarSeed: 'owl' };
const NEEDS_AUTHOR = {
  ok: false,
  failure: { code: 'author_required', kind: 'needs-author' },
};
const fetchMock = vi.fn();
const inPhase = vi.fn((send: () => Promise<FeedbackPostResult>) => send());
const beforePicker = vi.fn();

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

function submit(allowPublish: boolean, signal = new AbortController().signal) {
  return submitFeedbackPost({
    attempt: first(),
    post: {
      gameId: GAME,
      type: 'feedback',
      message: 'Text',
      screenshots: [SHOT],
      allowPublish,
    },
    signal,
    inPhase,
    beforePicker,
  });
}

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
    expect(inPhase).toHaveBeenCalledTimes(1);
  });

  it('gets the nickname for a public post before any screenshot uploads', async () => {
    const { signal } = new AbortController();

    expect(await submit(true, signal)).toMatchObject({ ok: true, outcome: 'pending' });

    expect(authors.ensureAuthor).toHaveBeenCalledWith(signal);
    const [gate] = authors.ensureAuthor.mock.invocationCallOrder;
    const [upload] = client.requestFeedbackUploadUrls.mock.invocationCallOrder;
    const [phase] = inPhase.mock.invocationCallOrder;
    expect(gate).toBeLessThan(phase);
    expect(phase).toBeLessThan(upload);
  });

  it('sends and uploads nothing when the picker is closed', async () => {
    authors.ensureAuthor.mockResolvedValue(null);

    expect(await submit(true)).toBeNull();

    expect(inPhase).not.toHaveBeenCalled();
    expect(client.requestFeedbackUploadUrls).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(client.sendFeedback).not.toHaveBeenCalled();
  });

  it('sends nothing when the modal closes while the nickname is picked', async () => {
    const controller = new AbortController();
    authors.ensureAuthor.mockImplementation(() => {
      controller.abort();
      return Promise.resolve(OWL);
    });

    expect(await submit(true, controller.signal)).toBeNull();

    expect(client.requestFeedbackUploadUrls).not.toHaveBeenCalled();
    expect(client.sendFeedback).not.toHaveBeenCalled();
  });

  it('resends the same post once after author_required, with no second upload', async () => {
    client.sendFeedback.mockResolvedValueOnce(NEEDS_AUTHOR);

    expect(await submit(true)).toMatchObject({ ok: true, outcome: 'pending' });

    expect(authors.forgetAuthor).toHaveBeenCalledTimes(1);
    expect(client.prefetchReviewCaptcha).toHaveBeenCalledWith('review');
    expect(beforePicker).toHaveBeenCalledTimes(1);
    expect(authors.ensureAuthor).toHaveBeenCalledTimes(2);
    expect(sentIds()).toEqual([POST, POST]);
    expect(client.requestFeedbackUploadUrls).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(inPhase).toHaveBeenCalledTimes(2);
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
    expect(beforePicker).not.toHaveBeenCalled();
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
    expect(beforePicker).not.toHaveBeenCalled();
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

  it('opens no picker and resends nothing once the modal closed during the send', async () => {
    const controller = new AbortController();
    client.sendFeedback.mockImplementationOnce(() => {
      controller.abort();
      return Promise.resolve(NEEDS_AUTHOR);
    });

    expect(await submit(true, controller.signal)).toMatchObject({ ok: false });

    expect(authors.ensureAuthor).toHaveBeenCalledTimes(1);
    expect(beforePicker).not.toHaveBeenCalled();
    expect(sentIds()).toEqual([POST]);
  });

  it('resends nothing when the modal closes while the picker is open', async () => {
    const controller = new AbortController();
    client.sendFeedback.mockResolvedValueOnce(NEEDS_AUTHOR);
    authors.ensureAuthor.mockResolvedValueOnce(OWL).mockImplementationOnce(() => {
      controller.abort();
      return Promise.resolve(OWL);
    });

    expect(await submit(true, controller.signal)).toMatchObject({ ok: false });

    expect(sentIds()).toEqual([POST]);
  });
});
