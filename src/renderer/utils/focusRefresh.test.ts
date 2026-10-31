import { describe, expect, it } from 'vitest';
import {
  type FocusAsk,
  type FocusQueryState,
  type FocusRefresh,
  focusRefresh,
} from './focusRefresh';

const SETTLED: FocusQueryState = {
  hasData: true,
  pageFocusKey: undefined,
  isFetching: false,
  isRefetchError: false,
  dataUpdatedAt: 100,
  errorUpdateCount: 0,
};

const ASKED: FocusAsk = { focusKey: 'link', dataUpdatedAt: 100, errorUpdateCount: 0 };

describe('focusRefresh', () => {
  it.each<
    [string, Partial<FocusQueryState>, FocusAsk | null, string | null, FocusRefresh]
  >([
    ['a link over cached pages', {}, null, null, 'refresh'],
    [
      'a link after another one asked',
      {},
      { ...ASKED, focusKey: 'old' },
      null,
      'refresh',
    ],
    ['a fetch still out', { isFetching: true }, null, null, 'wait'],
    [
      'no data, which the first load fetches with the link',
      { hasData: false },
      null,
      null,
      'wait',
    ],
    [
      'a first load failed with no data',
      { hasData: false, errorUpdateCount: 1 },
      ASKED,
      null,
      'wait',
    ],
    ['a first page fetched for the link', { pageFocusKey: 'link' }, ASKED, null, 'wait'],
    [
      'a first page fetched for another link',
      { pageFocusKey: 'old' },
      null,
      null,
      'refresh',
    ],
    ['its refresh paused offline', {}, ASKED, null, 'wait'],
    ['data that landed without the link', { dataUpdatedAt: 200 }, ASKED, null, 'refresh'],
    [
      'its refresh failing',
      { isRefetchError: true, errorUpdateCount: 1 },
      ASKED,
      null,
      'give-up',
    ],
    [
      'a refetch error from before the ask',
      { isRefetchError: true, errorUpdateCount: 1 },
      { ...ASKED, errorUpdateCount: 1 },
      null,
      'wait',
    ],
    ['a next page failing', { errorUpdateCount: 1 }, ASKED, null, 'wait'],
    [
      'a cache patch after its refresh failed',
      { dataUpdatedAt: 200, errorUpdateCount: 1 },
      ASKED,
      'link',
      'give-up',
    ],
    [
      'a page with its key after it failed',
      { pageFocusKey: 'link' },
      ASKED,
      'link',
      'give-up',
    ],
  ])('answers %s', (_case, query, ask, failedKey, expected) => {
    expect(
      focusRefresh({ focusKey: 'link', failedKey, ask, query: { ...SETTLED, ...query } })
    ).toBe(expected);
  });
});
