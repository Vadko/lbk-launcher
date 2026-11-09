import { t } from '@/shared/i18n/i18n';
import { Loader } from '../ui/Loader';
import { Pagination } from '../ui/Pagination';
import { type RatingsFilter, rankedRows } from './ratingsFilter';

export interface RatingsColumn<T> {
  id: string;
  header: React.ReactNode;
  render: (item: T) => React.ReactNode;
  className?: string;
}

interface RatingsTableProps<T> {
  columns: RatingsColumn<T>[];
  items: readonly T[] | null;
  failed: boolean;
  getKey: (item: T) => string;
  getName: (item: T) => string;
  filter: RatingsFilter | null;
  caption: string;
  page: number;
  onPageChange: (page: number) => void;
}

const PODIUM_SIZE = 3;
const PAGE_SIZE = 10;

export const RatingsTable = <T,>({
  columns,
  items,
  failed,
  getKey,
  getName,
  filter,
  caption,
  page,
  onPageChange,
}: RatingsTableProps<T>) => {
  const list = rankedRows(items ?? [], filter, getKey, getName);
  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  // The store reloads on catalog events, so the list can shrink under the open page
  const current = Math.min(page, pageCount);
  const offset = (current - 1) * PAGE_SIZE;

  return (
    <div className="overflow-hidden glass-card-no-motion flex flex-col p-0!">
      <div className="overflow-x-auto custom-scrollbar [scrollbar-gutter:auto]! [&::-webkit-scrollbar]:h-3">
        <table className="w-full min-w-[760px] table-fixed border-collapse text-sm">
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
          <tbody>
            {list.slice(offset, offset + PAGE_SIZE).map(({ item, rank }) => (
              <tr key={getKey(item)} className="border-b border-white/3">
                <th
                  scope="row"
                  className={`py-4 font-normal ${rank <= PODIUM_SIZE ? 'text-color-main' : 'text-text-muted'}`}
                >
                  {rank}
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
        </table>
      </div>

      {failed ? (
        <p className="text-center text-text-muted py-12">{t('ratings.loadFailed')}</p>
      ) : items === null ? (
        <div className="flex justify-center py-12">
          <Loader size="md" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-center text-text-muted py-12">{t('ratings.empty')}</p>
      ) : list.length === 0 ? (
        <p className="text-center text-text-muted py-12">
          {t('ratings.search.noResults')}
        </p>
      ) : null}

      {pageCount > 1 && (
        <div className="p-4">
          <Pagination
            page={current}
            pageCount={pageCount}
            onChange={onPageChange}
            label={t('ratings.pages', { caption })}
          />
        </div>
      )}
    </div>
  );
};
