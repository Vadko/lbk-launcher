import { beforeEach, describe, expect, it, vi } from 'vitest';

const replies: ((gameIds: string[]) => void)[] = [];
const setLike = vi.fn(() => new Promise<string[]>((resolve) => replies.push(resolve)));
vi.stubGlobal('window', { electronAPI: { setLike } });

const { useLikesStore } = await import('./useLikesStore');

const liked = () => [...useLikesStore.getState().likedGameIds].sort();
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  replies.length = 0;
  setLike.mockClear();
  useLikesStore.setState({ likedGameIds: new Set(), pendingClicks: {} });
});

describe('useLikesStore', () => {
  it('keeps the latest click while main still answers earlier ones', async () => {
    const { toggleLike, setLikedGameIds } = useLikesStore.getState();

    toggleLike('a');
    toggleLike('a');
    setLikedGameIds(['a', 'b']);
    expect(liked()).toEqual(['b']);

    replies[0](['a', 'b']);
    await flush();
    expect(liked()).toEqual(['b']);

    replies[1](['b']);
    await flush();
    expect(liked()).toEqual(['b']);
    expect(useLikesStore.getState().pendingClicks).toEqual({});
  });

  it('takes the state from main once the last click is answered', async () => {
    useLikesStore.getState().toggleLike('a');
    expect(liked()).toEqual(['a']);

    replies[0]([]);
    await flush();
    expect(liked()).toEqual([]);
    expect(setLike).toHaveBeenCalledWith('a', true);
  });

  it('shows the click as undone when main cannot answer', async () => {
    setLike.mockReturnValueOnce(Promise.reject(new Error('ipc')));
    useLikesStore.getState().toggleLike('a');
    expect(liked()).toEqual(['a']);

    await flush();
    expect(liked()).toEqual([]);
    expect(useLikesStore.getState().pendingClicks).toEqual({});
  });

  it('lets a later click decide when an earlier one fails', async () => {
    setLike.mockReturnValueOnce(Promise.reject(new Error('ipc')));
    const { toggleLike } = useLikesStore.getState();
    toggleLike('a');
    toggleLike('a');

    await flush();
    expect(liked()).toEqual([]);
    expect(useLikesStore.getState().pendingClicks).toEqual({ a: 1 });

    replies[0](['a']);
    await flush();
    expect(liked()).toEqual(['a']);
    expect(useLikesStore.getState().pendingClicks).toEqual({});
  });
});
