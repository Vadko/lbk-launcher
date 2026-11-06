import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  EllipsisIcon,
  type LucideIcon,
} from 'lucide-react';
import React from 'react';
import { t } from '@/shared/i18n/i18n';
import { pageItems } from './pageItems';

interface PaginationProps {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  label: string;
}

const CELL = 'size-8 flex items-center justify-center rounded-lg transition-colors';
const CONTROL = `${CELL} text-text-main hover:bg-glass-hover aria-disabled:opacity-30 aria-disabled:pointer-events-none`;

export const Pagination: React.FC<PaginationProps> = ({
  page,
  pageCount,
  onChange,
  label,
}) => {
  // aria-disabled, not disabled: a disabled button drops the focus the gamepad was on
  const control = (Icon: LucideIcon, name: string, target: number, off: boolean) => (
    <button
      type="button"
      className={CONTROL}
      aria-disabled={off}
      aria-label={name}
      onClick={() => {
        if (!off) {
          onChange(target);
        }
      }}
      data-gamepad-action
    >
      <Icon size={16} />
    </button>
  );
  const atStart = page === 1;
  const atEnd = page === pageCount;

  return (
    <nav
      aria-label={label}
      className="flex items-center justify-center gap-2 py-3 rounded-lg bg-glass"
    >
      {control(ChevronsLeftIcon, t('pagination.first'), 1, atStart)}
      {control(ChevronLeftIcon, t('pagination.previous'), page - 1, atStart)}
      {pageItems(page, pageCount).map((item) =>
        typeof item === 'number' ? (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            aria-current={item === page ? 'page' : undefined}
            data-gamepad-action
            className={`${CELL} ${
              item === page
                ? 'bg-color-main text-text-dark'
                : 'bg-glass text-text-main hover:bg-glass-hover'
            }`}
          >
            {item}
          </button>
        ) : (
          <span key={item} aria-hidden className={`${CELL} text-text-muted`}>
            <EllipsisIcon size={16} />
          </span>
        )
      )}
      {control(ChevronRightIcon, t('pagination.next'), page + 1, atEnd)}
      {control(ChevronsRightIcon, t('pagination.last'), pageCount, atEnd)}
    </nav>
  );
};
