import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReviewEditInput, ReviewReplyInput } from '@/shared/game-reviews-api-types';
import type { ReviewAuthorIdentity } from '@/shared/game-reviews-types';
import { useReviewOverlayStore } from '../store/useReviewOverlayStore';
import type { ReviewPages } from '../utils/reviewCache';
import {
  flush,
  heldWrites,
  liveSignal,
  needsAuthor,
  OWL,
  published,
  REVIEWS_KEY,
  seedReviews,
  shownEntry,
  type WriteAnswer,
} from './reviewActions.fixture';

const sendReviewReply = vi.fn<(input: ReviewReplyInput) => Promise<WriteAnswer>>();
const sendReviewEdit = vi.fn<(input: ReviewEditInput) => Promise<WriteAnswer>>();
const ensureAuthor =
  vi.fn<(signal?: AbortSignal) => Promise<ReviewAuthorIdentity | null>>();
const forgetAuthor = vi.fn();
const showToast = vi.fn();
vi.mock('./reviewsClient', () => ({ sendReviewReply, sendReviewEdit }));
vi.mock('../store/useSubscriptionsStore', () => ({
  useSubscriptionsStore: { getState: () => ({ showToast }) },
}));
vi.mock('../store/useReviewAuthorStore', () => ({
  useReviewAuthorStore: { getState: () => ({ ensureAuthor, forgetAuthor }) },
}));

const { createReviewActions } = await import('./createReviewActions');

let queryClient: QueryClient;

function seed(isPublic: boolean, viewer: ReviewAuthorIdentity | null = null) {
  seedReviews(queryClient, isPublic, viewer);
  return createReviewActions(queryClient, 'g1', 'Game');
}

const sentIds = () => sendReviewReply.mock.calls.map(([input]) => input.id);
const cached = () => queryClient.getQueryData<ReviewPages>(REVIEWS_KEY);
const shown = (id: string) => shownEntry(queryClient, id);

beforeEach(() => {
  queryClient = new QueryClient();
  useReviewOverlayStore.setState({ games: new Map(), rolledBack: new Map() });
  showToast.mockReset();
  sendReviewReply.mockReset();
  sendReviewReply.mockImplementation(({ id }) => Promise.resolve(published(id)));
  sendReviewEdit.mockReset();
  sendReviewEdit.mockImplementation(({ id }) => Promise.resolve(published(id)));
  ensureAuthor.mockReset();
  forgetAuthor.mockReset();
});

describe('createReviewActions nickname', () => {
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
    expect(shown(sentIds()[0])?.author).toMatchObject({ name: OWL.name, isMine: true });
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
    expect(shown(sentIds()[0])?.author).toMatchObject({
      name: OWL.name,
      avatarSeed: OWL.avatarSeed,
    });
  });

  it('sends nothing and keeps the composer open when the picker is closed', async () => {
    ensureAuthor.mockResolvedValue(null);
    const onShown = vi.fn();
    const actions = seed(true);
    const before = cached();

    await expect(actions.sendReply('t', 'hi', null, onShown, liveSignal())).resolves.toBe(
      false
    );
    await flush();

    expect(sendReviewReply).not.toHaveBeenCalled();
    expect(onShown).not.toHaveBeenCalled();
    expect(cached()).toBe(before);
    expect(heldWrites().size).toBe(0);
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
    const before = cached();
    const composer = new AbortController();

    const sent = actions.sendReply('t', 'hi', null, onShown, composer.signal);
    composer.abort();
    pick(OWL);

    await expect(sent).resolves.toBe(false);
    await flush();
    expect(sendReviewReply).not.toHaveBeenCalled();
    expect(onShown).not.toHaveBeenCalled();
    expect(cached()).toBe(before);
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
    expect(heldWrites().size).toBe(0);
    expect(shown(sentIds()[0])).toMatchObject({
      author: { name: OWL.name },
      moderation: 'published',
    });
    expect(shown(sentIds()[0])?.failure).toBeUndefined();
  });

  it('keeps the reply unsent when the picker is closed and asks again on resend', async () => {
    sendReviewReply.mockResolvedValueOnce(needsAuthor);
    ensureAuthor.mockResolvedValueOnce(null).mockResolvedValueOnce(OWL);
    const actions = seed(true, { name: 'Gone Name', avatarSeed: 'ffffffffffff' });

    await actions.sendReply('t', 'hi', null, vi.fn(), liveSignal());
    await vi.waitFor(() => expect(ensureAuthor).toHaveBeenCalledTimes(1));
    await flush();
    const id = sentIds()[0];
    expect(shown(id)?.failure?.kind).toBe('needs-author');

    await actions.resend(id);

    expect(ensureAuthor).toHaveBeenCalledTimes(2);
    expect(sentIds()).toEqual([id, id]);
    expect(shown(id)?.failure).toBeUndefined();
  });

  it('opens the picker by itself only once for a reply', async () => {
    sendReviewReply.mockResolvedValue(needsAuthor);
    ensureAuthor.mockResolvedValue(OWL);

    await seed(true, OWL).sendReply('t', 'hi', null, vi.fn(), liveSignal());
    await vi.waitFor(() => expect(sendReviewReply).toHaveBeenCalledTimes(2));
    await flush();

    expect(ensureAuthor).toHaveBeenCalledTimes(1);
    expect(shown(sentIds()[0])?.failure?.kind).toBe('needs-author');
  });

  it('signs the edited entry with the picked nickname and resends the edit', async () => {
    sendReviewEdit.mockResolvedValueOnce(needsAuthor);
    ensureAuthor.mockResolvedValue(OWL);

    await seed(false).edit('mine', 'changed', vi.fn());
    await vi.waitFor(() => expect(sendReviewEdit).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(heldWrites().size).toBe(0));

    expect(sendReviewEdit.mock.calls.map(([input]) => input.id)).toEqual([
      'mine',
      'mine',
    ]);
    expect(shown('mine')).toMatchObject({
      text: 'changed',
      author: { name: OWL.name, avatarSeed: OWL.avatarSeed },
    });
  });
});
