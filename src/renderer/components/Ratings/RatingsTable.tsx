import React from 'react';
import { Loader } from '../ui/Loader';
import { Pagination } from '../ui/Pagination';

export interface RatingsColumn<T> {
  header: string;
  render: (item: T) => React.ReactNode;
  className?: string;
}

interface RatingsTableProps<T> {
  columns: RatingsColumn<T>[];
  items: T[] | undefined;
  getKey: (item: T) => string;
  offset: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isPending: boolean;
  isError: boolean;
  isPlaceholderData: boolean;
  paginationLabel: string;
  caption: string;
}

const cellClass = 'px-1.5 py-4 text-center align-middle';

export const RatingsTable = <T,>({
  columns,
  items,
  getKey,
  offset,
  page,
  totalPages,
  onPageChange,
  isPending,
  isError,
  isPlaceholderData,
  paginationLabel,
  caption,
}: RatingsTableProps<T>) => {
  const message = isPending ? null : isError || !items ? (
    <p className="text-center text-text-muted py-12">
      Не вдалося завантажити рейтинг. Спробуйте пізніше.
    </p>
  ) : items.length === 0 ? (
    <p className="text-center text-text-muted py-12">Поки що немає даних.</p>
  ) : null;

  return (
    <div className="overflow-hidden glass-card-no-motion flex flex-col !p-0">
      <div className="overflow-x-auto custom-scrollbar ![scrollbar-gutter:auto] [&::-webkit-scrollbar]:h-3">
        <table
          aria-busy={isPending || isPlaceholderData}
          className={`w-full min-w-[760px] table-fixed border-collapse text-sm transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}
        >
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="bg-[#333333] text-white">
              <th scope="col" className="w-[72px] py-4 font-bold">
                №
              </th>
              {columns.map((column) => (
                <th
                  key={column.header}
                  scope="col"
                  className="px-1.5 py-4 text-center font-bold last:pr-4"
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          {!isPending && items && items.length > 0 && (
            <tbody>
              {items.map((item, i) => (
                <tr key={getKey(item)} className="border-b border-white/[0.03]">
                  <th
                    scope="row"
                    className={`py-4  font-normal ${offset + i < 3 ? 'text-color-main' : 'text-text-muted'}`}
                  >
                    {offset + i + 1}
                  </th>
                  {columns.map((column) => (
                    <td
                      key={column.header}
                      className={`${cellClass} last:pr-4 ${column.className ?? ''}`}
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

      {isPending && (
        <div className="flex justify-center py-12">
          <Loader size="md" />
        </div>
      )}
      {message}

      {totalPages > 1 && (
        <div className="p-4">
          <Pagination
            page={page}
            totalPages={totalPages}
            onChange={onPageChange}
            ariaLabel={paginationLabel}
          />
        </div>
      )}
    </div>
  );
};
