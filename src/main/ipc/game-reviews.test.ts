import { beforeEach, describe, expect, it, vi } from 'vitest';

type Handler = (event: unknown, input?: unknown) => Promise<unknown>;

const state = vi.hoisted(() => ({
  handlers: new Map<string, Handler>(),
  api: vi.fn(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: Handler) => state.handlers.set(channel, handler),
  },
}));
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
  state.api.mockResolvedValue({ ok: true, data: null });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('setupGameReviewsHandlers', () => {
  it.each([
    ['reviews:list', { gameId: OTHER, cursor: null }],
    ['reviews:reply', { id: ID, reviewId: OTHER, parentId: null, text: 'hi' }],
    ['reviews:edit', { id: ID, text: 'hi' }],
    [
      'reviews:spin',
      { spinId: null, hold: { avatar: false, adjective: true, noun: false } },
    ],
    ['reviews:claim', { spinId: ID }],
    [
      'reviews:submit-feedback',
      { id: ID, gameId: OTHER, type: 'feedback', message: 'hi', screenshotPaths: [] },
    ],
    ['reviews:upload-urls', { id: ID, fileNames: ['a.png'] }],
  ])('passes a valid %s call through', async (channel, input) => {
    await call(channel, input);

    expect(state.api).toHaveBeenCalledWith(input);
  });

  it('reads the author without input', async () => {
    await call('reviews:author');

    expect(state.api).toHaveBeenCalledWith();
  });

  it('hands over the trimmed text', async () => {
    await call('reviews:edit', { id: ID, text: '  hi \n' });

    expect(state.api).toHaveBeenCalledWith({ id: ID, text: 'hi' });
  });

  it('drops a machine id or captcha token the renderer slips in', async () => {
    await call('reviews:edit', { id: ID, text: 'hi', machineId: 'x', captchaToken: 'y' });

    expect(state.api).toHaveBeenCalledWith({ id: ID, text: 'hi' });
  });

  it.each([
    ['reviews:list', { gameId: 'not-a-uuid', cursor: null }],
    ['reviews:reply', { id: ID, reviewId: OTHER, parentId: null, text: '   ' }],
    ['reviews:reply', { id: ID, reviewId: OTHER, text: 'hi' }],
    ['reviews:edit', { id: ID, text: 'x'.repeat(1001) }],
    ['reviews:spin', { spinId: null, hold: { avatar: false } }],
    ['reviews:claim', {}],
    [
      'reviews:submit-feedback',
      { id: ID, gameId: OTHER, type: 'praise', message: 'hi', screenshotPaths: [] },
    ],
    ['reviews:upload-urls', { id: ID, fileNames: [] }],
    ['reviews:upload-urls', { id: ID, fileNames: Array(6).fill('a.png') }],
  ])('refuses a malformed %s call without a request', async (channel, input) => {
    expect(await call(channel, input)).toEqual({
      ok: false,
      failure: { code: 'invalid_body', kind: 'rejected' },
    });
    expect(state.api).not.toHaveBeenCalled();
  });

  it('counts the text limit in code points, as the server does', async () => {
    await call('reviews:edit', { id: ID, text: '\u{1F600}'.repeat(1000) });

    expect(state.api).toHaveBeenCalledTimes(1);
  });
});
