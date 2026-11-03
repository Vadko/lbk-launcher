import type { UseInfiniteQueryResult } from '@tanstack/react-query';
import React, { useCallback } from 'react';
import { t } from '@/shared/i18n/i18n';
import { useInfiniteScrollSentinel } from '../../hooks/useInfiniteScrollSentinel';
import { Loader } from '../ui/Loader';

export interface RatingsColumn<T> {
  id: string;
  header: React.ReactNode;
  render: (item: T) => React.ReactNode;
  className?: string;
}

interface RatingsTableProps<T> {
  columns: RatingsColumn<T>[];
  query: UseInfiniteQueryResult<T[], Error>;
  getKey: (item: T) => string;
  caption: string;
}

const PODIUM_SIZE = 3;

export const RatingsTable = <T,>({
  columns,
  query,
  getKey,
  caption,
}: RatingsTableProps<T>) => {
  const {
    data: items,
    isPending,
    isError,
    hasNextPage,
    isFetching,
    fetchNextPage,
  } = query;
  // A next page would cancel an event's refetch, which then leaves the loaded pages stale
  const loadNextPage = useCallback(
    () => void fetchNextPage({ cancelRefetch: false }),
    [fetchNextPage]
  );
  const attachSentinel = useInfiniteScrollSentinel({
    hasNextPage,
    // A next page asked during a refetch joins it and adds nothing, so the sentinel looks again after
    isBusy: isFetching,
    fetchNextPage: loadNextPage,
  });

  return (
    <div className="overflow-hidden glass-card-no-motion flex flex-col p-0!">
      <div className="overflow-x-auto custom-scrollbar [scrollbar-gutter:auto]! [&::-webkit-scrollbar]:h-3">
        <table
          aria-busy={isFetching}
          className="w-full min-w-[760px] table-fixed border-collapse text-sm"
        >
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="bg-glass-hover text-text-main">
              <th scope="col" className="w-[72px] py-4 font-bold">
                {t('ratings.column.rank')}
              </th>
              {columns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  className="px-1.5 py-4 text-center font-bold last:pr-4"
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          {items && items.length > 0 && (
            <tbody>
              {items.map((item, index) => (
                <tr key={getKey(item)} className="border-b border-white/3">
                  <th
                    scope="row"
                    className={`py-4 font-normal ${index < PODIUM_SIZE ? 'text-color-main' : 'text-text-muted'}`}
                  >
                    {index + 1}
                  </th>
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className={`px-1.5 py-4 text-center align-middle last:pr-4 ${column.className ?? ''}`}
                    >
                      {column.render(item)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>

      {isPending ? (
        <div className="flex justify-center py-12">
          <Loader size="md" />
        </div>
      ) : isError && !items ? (
        <p className="text-center text-text-muted py-12">{t('ratings.loadFailed')}</p>
      ) : items?.length === 0 ? (
        <p className="text-center text-text-muted py-12">{t('ratings.empty')}</p>
      ) : null}
      {hasNextPage && <div ref={attachSentinel} className="h-1" aria-hidden />}
      {query.isFetchingNextPage && (
        <div className="flex justify-center py-6">
          <Loader size="sm" />
        </div>
      )}
    </div>
  );
};
