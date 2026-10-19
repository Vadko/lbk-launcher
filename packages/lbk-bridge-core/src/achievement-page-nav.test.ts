import { describe, expect, it, vi } from 'vitest';
import { type NavWindow, watchSameDocumentUrl } from './achievement-page-nav';

const START = 'https://steamcommunity.com/id/someone/games/?tab=all';
const NEXT = 'https://steamcommunity.com/id/someone/achievements/620';

// A document whose History moves location.href as Chrome's does.
function historyWindow() {
  const events = new EventTarget();
  const location = { href: START };
  const pushState = vi.fn(
    (_data: unknown, _unused: string, url?: string | URL | null) => {
      location.href = String(url);
    }
  );
  const replaceState = vi.fn();
  const history = { pushState, replaceState };
  const win: NavWindow = {
    location,
    history,
    addEventListener: (type, listener) => events.addEventListener(type, listener),
    removeEventListener: (type, listener) => events.removeEventListener(type, listener),
  };
  const popstate = () => events.dispatchEvent(new Event('popstate'));
  return { win, history, pushState, replaceState, popstate };
}

describe('watchSameDocumentUrl', () => {
  it('follows currententrychange of the Navigation API and leaves History alone', () => {
    const navigation = new EventTarget();
    const { win, history, pushState } = historyWindow();
    const onChange = vi.fn();
    const stop = watchSameDocumentUrl({ ...win, navigation }, onChange);

    expect(history.pushState).toBe(pushState);
    navigation.dispatchEvent(new Event('currententrychange'));
    navigation.dispatchEvent(new Event('navigate'));
    expect(onChange).toHaveBeenCalledOnce();
    stop?.();
    navigation.dispatchEvent(new Event('currententrychange'));
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('falls back to History: reports after the app call with the new URL, and on popstate', () => {
    const { win, history, pushState, replaceState, popstate } = historyWindow();
    const urls: string[] = [];
    const stop = watchSameDocumentUrl(win, () => urls.push(win.location.href));

    history.pushState({ page: 1 }, '', NEXT);
    expect(pushState).toHaveBeenCalledWith({ page: 1 }, '', NEXT);
    history.replaceState(null, '');
    expect(replaceState).toHaveBeenCalledWith(null, '');
    popstate();
    expect(urls).toEqual([NEXT, NEXT, NEXT]);

    stop?.();
    expect(history.pushState).toBe(pushState);
    expect(history.replaceState).toBe(replaceState);
    popstate();
    expect(urls).toHaveLength(3);
  });

  it('reports nothing when the app call throws', () => {
    const { win, history, pushState } = historyWindow();
    pushState.mockImplementationOnce(() => {
      throw new Error('SecurityError');
    });
    const onChange = vi.fn();
    watchSameDocumentUrl(win, onChange);
    expect(() => history.pushState(null, '', 'https://example.com/')).toThrow();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps a patch the app put over its own on stop', () => {
    const { win, history } = historyWindow();
    const stop = watchSameDocumentUrl(win, vi.fn());
    const appPatch = vi.fn();
    history.pushState = appPatch;
    stop?.();
    expect(history.pushState).toBe(appPatch);
  });

  it('cannot watch a document without the Navigation API or History', () => {
    expect(watchSameDocumentUrl({ location: { href: START } }, vi.fn())).toBeUndefined();
  });
});
