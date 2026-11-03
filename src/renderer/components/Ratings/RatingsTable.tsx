import type { UseQueryResult } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import React, { type RefObject, useRef } from 'react';
import { t } from '@/shared/i18n/i18n';
import { useOffsetInScroller } from '../../hooks/useOffsetInScroller';
import { Loader } from '../ui/Loader';

export interface RatingsColumn<T> {
  id: string;
  header: React.ReactNode;
  render: (item: T) => React.ReactNode;
  className?: string;
}

interface RatingsTableProps<T> {
  columns: RatingsColumn<T>[];
  query: UseQueryResult<T[], Error>;
  getKey: (item: T) => string;
  caption: string;
  scrollerRef: RefObject<HTMLElement | null>;
}

const PODIUM_SIZE = 3;
const ROW_ESTIMATE = 69;
// Keeps the rows next to the visible ones mounted, so the gamepad finds them below the fold
const OVERSCAN = 10;

export const RatingsTable = <T,>({
  columns,
  query,
  getKey,
  caption,
  scrollerRef,
}: RatingsTableProps<T>) => {
  const { data: items = [], isPending, isError, isFetching } = query;
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const scrollMargin = useOffsetInScroller(scrollerRef, bodyRef);
  // eslint-disable-next-line react-hooks/incompatible-library -- the build runs no React Compiler, so nothing memoizes this component
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollerRef.current,
    estimateSize: () => ROW_ESTIMATE,
    overscan: OVERSCAN,
    scrollMargin,
    getItemKey: (index) => getKey(items[index]),
  });
  const rows = virtualizer.getVirtualItems();
  const before = rows.length > 0 ? rows[0].start - scrollMargin : 0;
  const after =
    rows.length > 0
      ? virtualizer.getTotalSize() - (rows[rows.length - 1].end - scrollMargin)
      : 0;
  const spacer = (height: number) =>
    height > 0 && (
      <tr aria-hidden>
        <td colSpan={columns.length + 1} className="p-0" style={{ height }} />
      </tr>
    );

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
          <tbody ref={bodyRef}>
            {spacer(before)}
            {rows.map((row) => (
              <tr
                key={row.key}
                ref={virtualizer.measureElement}
                data-index={row.index}
                className="border-b border-white/3"
              >
                <th
                  scope="row"
                  className={`py-4 font-normal ${row.index < PODIUM_SIZE ? 'text-color-main' : 'text-text-muted'}`}
                >
                  {row.index + 1}
                </th>
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className={`px-1.5 py-4 text-center align-middle last:pr-4 ${column.className ?? ''}`}
                  >
                    {column.render(items[row.index])}
                  </td>
                ))}
              </tr>
            ))}
            {spacer(after)}
          </tbody>
        </table>
      </div>

      {isPending ? (
        <div className="flex justify-center py-12">
          <Loader size="md" />
        </div>
      ) : isError && items.length === 0 ? (
        <p className="text-center text-text-muted py-12">{t('ratings.loadFailed')}</p>
      ) : items.length === 0 ? (
        <p className="text-center text-text-muted py-12">{t('ratings.empty')}</p>
      ) : null}
    </div>
  );
};
