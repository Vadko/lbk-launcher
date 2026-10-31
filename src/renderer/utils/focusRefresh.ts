// What the link's own refresh went out over
export interface FocusAsk {
  focusKey: string;
  dataUpdatedAt: number;
  errorUpdateCount: number;
}

export interface FocusQueryState {
  hasData: boolean;
  // The link whose focus thread the cached first page was fetched with
  pageFocusKey: string | undefined;
  isFetching: boolean;
  isRefetchError: boolean;
  dataUpdatedAt: number;
  errorUpdateCount: number;
}

interface FocusRefreshInput {
  focusKey: string;
  // Stays given up once a cache patch clears the query's error
  failedKey: string | null;
  ask: FocusAsk | null;
  query: FocusQueryState;
}

export type FocusRefresh = 'refresh' | 'wait' | 'give-up';

// Without data the first load already carries the link, and so does the retry of its error block
export function focusRefresh({
  focusKey,
  failedKey,
  ask,
  query,
}: FocusRefreshInput): FocusRefresh {
  if (focusKey === failedKey) {
    return 'give-up';
  }
  if (query.isFetching || !query.hasData || query.pageFocusKey === focusKey) {
    return 'wait';
  }
  if (ask?.focusKey !== focusKey) {
    return 'refresh';
  }
  // Only the link's own refetch ends it: a next-page error or one from before the ask does not
  if (query.isRefetchError && query.errorUpdateCount > ask.errorUpdateCount) {
    return 'give-up';
  }
  // A paused refetch lands nothing, while data that landed without the link asks again
  return query.dataUpdatedAt === ask.dataUpdatedAt ? 'wait' : 'refresh';
}
