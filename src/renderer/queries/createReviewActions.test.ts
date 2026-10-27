import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ReviewReplyInput,
  ReviewResult,
  ReviewWriteResult,
} from '@/shared/game-reviews-api-types';
import type { ReviewAuthorIdentity } from '@/shared/game-reviews-types';
import { findEntry, type ReviewPages } from '../utils/reviewCache';
import { reviewPages, reviewThread } from '../utils/reviewPages.fixture';
import { gameReviewsQueryKey } from './gameReviewsQueryKey';

const sendReviewReply =
  vi.fn<(input: ReviewReplyInput) => Promise<ReviewResult<ReviewWriteResult>>>();
const ensureAuthor =
  vi.fn<(signal?: AbortSignal) => Promise<ReviewAuthorIdentity | null>>();
const forgetAuthor = vi.fn();
vi.mock('./reviewsClient', () => ({ sendReviewReply, sendReviewEdit: vi.fn() }));
vi.mock('../store/useReviewAuthorStore', () => ({
  useReviewAuthorStore: { getState: () => ({ ensureAuthor, forgetAuthor }) },
}));

const { createReviewActions } = await import('./createReviewActions');

const OWL: ReviewAuthorIdentity = { name: 'Quiet Owl', avatarSeed: '0a1b2c3d4e5f' };
const KEY = gameReviewsQueryKey('g1');
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const published = (id: string): ReviewResult<ReviewWriteResult> => ({
  ok: true,
  data: { id, outcome: 'published' },
});
const needsAuthor: ReviewResult<ReviewWriteResult> = {
  ok: false,
  failure: { code: 'author_required', kind: 'needs-author' },
};

let queryClient: QueryClient;

function seed(isPublic: boolean, viewer: ReviewAuthorIdentity | null = null) {
  const data = reviewPages([reviewThread('t', [], isPublic)]);
  queryClient.setQueryData<ReviewPages>(KEY, {
    ...data,
    pages: data.pages.map((page) => ({ ...page, viewer })),
  });
  return createReviewActions(queryClient, 'g1');
}

const liveSignal = () => new AbortController().signal;
const sentIds = () => sendReviewReply.mock.calls.map(([input]) => input.id);
const entry = (id: string) =>
  findEntry(queryClient.getQueryData<ReviewPages>(KEY), id)?.entry;

beforeEach(() => {
  queryClient = new QueryClient();
  sendReviewReply.mockReset();
  sendReviewReply.mockImplementation(({ id }) => Promise.resolve(published(id)));
  ensureAuthor.mockReset();
  forgetAuthor.mockReset();
});

describe('createReviewActions public reply gate', () => {
  it('sends a private reply without asking for a nickname', async () => {
    const onShown = vi.fn();

    await expect(
      seed(false).sendReply('t', 'hi', null, onShown, liveSignal())
    ).resolves.toBe(true);
    await flush();

    expect(ensureAuthor).not.toHaveBeenCalled();
    expect(sendReviewReply).toHaveBeenCalledWith(
      expect.objectContaining({ reviewId: 't', isPublic: false })
    );
    expect(onShown).toHaveBeenCalled();
  });

  it('signs a public reply with the nickname the pages already carry', async () => {
    await seed(true, OWL).sendReply('t', 'hi', null, vi.fn(), liveSignal());
    await flush();

    expect(ensureAuthor).not.toHaveBeenCalled();
    expect(entry(sentIds()[0])?.author).toMatchObject({ name: OWL.name, isMine: true });
  });

  it('asks for a nickname before a public reply and signs it with the claimed one', async () => {
    ensureAuthor.mockResolvedValue(OWL);

    await expect(
      seed(true).sendReply('t', 'hi', null, vi.fn(), liveSignal())
    ).resolves.toBe(true);
    await flush();

    expect(sendReviewReply).toHaveBeenCalledWith(
      expect.objectContaining({ isPublic: true, text: 'hi' })
    );
    expect(entry(sentIds()[0])?.author).toMatchObject({
      name: OWL.name,
      avatarSeed: OWL.avatarSeed,
    });
  });

  it('sends nothing and keeps the composer open when the picker is closed', async () => {
    ensureAuthor.mockResolvedValue(null);
    const onShown = vi.fn();
    const actions = seed(true);
    const before = queryClient.getQueryData(KEY);

    await expect(actions.sendReply('t', 'hi', null, onShown, liveSignal())).resolves.toBe(
      false
    );
    await flush();

    expect(sendReviewReply).not.toHaveBeenCalled();
    expect(onShown).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(KEY)).toBe(before);
  });

  it('hands the composer signal to the nickname lookup and sends nothing once it aborts', async () => {
    let lookedUp: (author: ReviewAuthorIdentity | null) => void = () => undefined;
    ensureAuthor.mockReturnValue(
      new Promise((resolve) => {
        lookedUp = resolve;
      })
    );
    const onShown = vi.fn();
    const composer = new AbortController();

    const sent = seed(true).sendReply('t', 'hi', null, onShown, composer.signal);
    expect(ensureAuthor).toHaveBeenCalledWith(composer.signal);
    composer.abort();
    lookedUp(null);

    await expect(sent).resolves.toBe(false);
    await flush();
    expect(sendReviewReply).not.toHaveBeenCalled();
    expect(onShown).not.toHaveBeenCalled();
  });

  it('drops a public reply whose composer closed while the nickname was picked', async () => {
    let pick: (author: ReviewAuthorIdentity) => void = () => undefined;
    ensureAuthor.mockReturnValue(
      new Promise((resolve) => {
        pick = resolve;
      })
    );
    const onShown = vi.fn();
    const actions = seed(true);
    const before = queryClient.getQueryData(KEY);
    const composer = new AbortController();

    const sent = actions.sendReply('t', 'hi', null, onShown, composer.signal);
    composer.abort();
    pick(OWL);

    await expect(sent).resolves.toBe(false);
    await flush();
    expect(sendReviewReply).not.toHaveBeenCalled();
    expect(onShown).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(KEY)).toBe(before);
  });

  it('opens the picker on a needs-author answer and resends the same id after a claim', async () => {
    sendReviewReply.mockResolvedValueOnce(needsAuthor);
    ensureAuthor.mockResolvedValue(OWL);

    await seed(true, { name: 'Gone Name', avatarSeed: 'ffffffffffff' }).sendReply(
      't',
      'hi',
      null,
      vi.fn(),
      liveSignal()
    );
    await vi.waitFor(() => expect(sendReviewReply).toHaveBeenCalledTimes(2));
    await flush();

    expect(forgetAuthor).toHaveBeenCalledTimes(1);
    expect(new Set(sentIds()).size).toBe(1);
    expect(entry(sentIds()[0])).toMatchObject({
      author: { name: OWL.name },
      moderation: 'published',
      isChecking: false,
      failure: undefined,
    });
  });

  it('keeps the reply unsent when the picker is closed and asks again on resend', async () => {
    sendReviewReply.mockResolvedValueOnce(needsAuthor);
    ensureAuthor.mockResolvedValueOnce(null).mockResolvedValueOnce(OWL);
    const actions = seed(true, { name: 'Gone Name', avatarSeed: 'ffffffffffff' });

    await actions.sendReply('t', 'hi', null, vi.fn(), liveSignal());
    await vi.waitFor(() => expect(ensureAuthor).toHaveBeenCalledTimes(1));
    await flush();
    const id = sentIds()[0];
    expect(entry(id)?.failure?.kind).toBe('needs-author');

    await actions.resend(id);

    expect(ensureAuthor).toHaveBeenCalledTimes(2);
    expect(sentIds()).toEqual([id, id]);
    expect(entry(id)?.failure).toBeUndefined();
  });

  it('opens the picker by itself only once for a reply', async () => {
    sendReviewReply.mockResolvedValue(needsAuthor);
    ensureAuthor.mockResolvedValue(OWL);

    await seed(true, OWL).sendReply('t', 'hi', null, vi.fn(), liveSignal());
    await vi.waitFor(() => expect(sendReviewReply).toHaveBeenCalledTimes(2));
    await flush();

    expect(ensureAuthor).toHaveBeenCalledTimes(1);
    expect(entry(sentIds()[0])?.failure?.kind).toBe('needs-author');
  });
});
