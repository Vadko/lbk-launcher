import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import React from 'react';

interface ReviewsPaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

type PageItem = number | 'ellipsis';

function getPageItems(page: number, totalPages: number): PageItem[] {
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  if (page <= 2) {
    pages.add(3);
  }
  if (page >= totalPages - 1) {
    pages.add(totalPages - 2);
  }

  const sorted = [...pages]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);
  const items: PageItem[] = [];
  sorted.forEach((p, i) => {
    const prev = sorted[i - 1];
    if (prev !== undefined && p - prev === 2) {
      items.push(prev + 1);
    } else if (prev !== undefined && p - prev > 2) {
      items.push('ellipsis');
    }
    items.push(p);
  });
  return items;
}

const controlClass =
  'size-8 flex items-center justify-center rounded-lg text-white transition-colors hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none';

export const ReviewsPagination: React.FC<ReviewsPaginationProps> = ({
  page,
  totalPages,
  onChange,
}) => (
  <nav
    aria-label="Сторінки відгуків"
    className="flex items-center justify-center gap-2 py-3 rounded-lg bg-white/5"
  >
    <button
      type="button"
      className={controlClass}
      disabled={page === 1}
      onClick={() => onChange(1)}
      aria-label="Перша сторінка"
      data-gamepad-action
    >
      <ChevronsLeft size={16} />
    </button>
    <button
      type="button"
      className={controlClass}
      disabled={page === 1}
      onClick={() => onChange(page - 1)}
      aria-label="Попередня сторінка"
      data-gamepad-action
    >
      <ChevronLeft size={16} />
    </button>
    {getPageItems(page, totalPages).map((item, i, items) =>
      item === 'ellipsis' ? (
        <span
          key={`ellipsis-after-${items[i - 1]}`}
          className="size-8 flex items-center justify-center"
        >
          ...
        </span>
      ) : (
        <button
          key={item}
          type="button"
          onClick={() => onChange(item)}
          aria-current={item === page ? 'page' : undefined}
          data-gamepad-action
          className={`size-8 flex items-center justify-center rounded-lg transition-colors ${
            item === page
              ? 'bg-color-main text-text-dark'
              : 'bg-white/[0.03] text-white hover:bg-white/10'
          }`}
        >
          {item}
        </button>
      )
    )}
    <button
      type="button"
      className={controlClass}
      disabled={page === totalPages}
      onClick={() => onChange(page + 1)}
      aria-label="Наступна сторінка"
      data-gamepad-action
    >
      <ChevronRight size={16} />
    </button>
    <button
      type="button"
      className={controlClass}
      disabled={page === totalPages}
      onClick={() => onChange(totalPages)}
      aria-label="Остання сторінка"
      data-gamepad-action
    >
      <ChevronsRight size={16} />
    </button>
  </nav>
);
