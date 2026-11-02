import { beforeEach, describe, expect, it, vi } from 'vitest';

type Handler = (event: unknown, input?: unknown) => Promise<unknown>;
type Listener = (event: unknown, input?: unknown) => void;

const state = vi.hoisted(() => ({
  handlers: new Map<string, Handler>(),
  listeners: new Map<string, Listener>(),
  api: vi.fn(),
  prefetch: vi.fn(),
  syncEvents: vi.fn(() => Promise.resolve()),
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: Handler) => state.handlers.set(channel, handler),
    on: (channel: string, listener: Listener) => state.listeners.set(channel, listener),
  },
}));
vi.mock('@/main/turnstile/tokens', () => ({ prefetchCaptchaToken: state.prefetch }));
vi.mock('@/main/db/game-reviews-api', () => ({ fetchGameReviews: state.api }));
vi.mock('@/main/db/review-actions-api', () => ({
  replyToReview: state.api,
  editReviewEntry: state.api,
}));
vi.mock('@/main/db/review-author-api', () => ({
  getReviewAuthor: state.api,
  spinReviewNickname: state.api,
  claimReviewNickname: state.api,
}));
vi.mock('@/main/review-events', () => ({ syncReviewEvents: state.syncEvents }));
vi.mock('@/main/db/submit-feedback-api', () => ({
  submitFeedback: state.api,
  getFeedbackUploadUrls: state.api,
}));

const { setupGameReviewsHandlers } = await import('./game-reviews');
setupGameReviewsHandlers();

const ID = '3d2c1b0a-9f8e-4d7c-8b6a-5f4e3d2c1b0a';
const OTHER = '0b6f3f0e-5c1a-4d2e-9f3b-2a1c4d5e6f70';

const call = (channel: string, input?: unknown) =>
  state.handlers.get(channel)?.(null, input) ?? Promise.reject(new Error('no handler'));

beforeEach(() => {
  state.api.mockReset();
  state.prefetch.mockReset();
  state.api.mockResolvedValue({ ok: true, data: null });
});

describe('setupGameReviewsHandlers', () => {
  it.each([
    ['reviews:list', { gameId: OTHER, cursor: null, focusId: ID }],
    [
      'reviews:reply',
      { id: ID, reviewId: OTHER, parentId: null, text: 'hi', isPublic: true },
    ],
    ['reviews:edit', { id: ID, text: 'hi', isPublic: false }],
    [
      'reviews:spin',
      { spinId: null, hold: { avatar: false, adjective: true, noun: false } },
    ],
    ['reviews:claim', { spinId: ID }],
    [
      'reviews:submit-feedback',
      {
        id: ID,
        gameId: OTHER,
        type: 'feedback',
        message: 'hi',
        screenshotPaths: [],
        allowPublish: true,
      },
    ],
    ['reviews:upload-urls', { id: ID, fileNames: ['a.png'] }],
  ])('passes a %s call through', async (channel, input) => {
    await call(channel, input);

    expect(state.api).toHaveBeenCalledWith(input);
  });

  it('reads the author without input', async () => {
    await call('reviews:author');

    expect(state.api).toHaveBeenCalledWith();
  });

  it('replays missed review events', async () => {
    await call('reviews:sync-events');

    expect(state.syncEvents).toHaveBeenCalledTimes(1);
  });

  it('prefetches a token for a known action', () => {
    state.listeners.get('reviews:prefetch-captcha')?.(null, 'reply');

    expect(state.prefetch).toHaveBeenCalledWith('reply');
  });
});
