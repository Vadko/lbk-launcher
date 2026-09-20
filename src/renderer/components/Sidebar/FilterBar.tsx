import { Bookmark, Download, SlidersHorizontal, X } from 'lucide-react';
import React from 'react';
import { Button } from '../ui/Button';
import { SortDropdown } from './SortDropdown';
import type { SortOrderType } from './types';

interface FilterBarProps {
  isHorizontal?: boolean;
  activeFilterCount: number;
  onOpenFilters: () => void;
  onClearAll: () => void;
  isInstalledQuickActive: boolean;
  onToggleInstalledQuick: () => void;
  isFavoriteQuickActive: boolean;
  onToggleFavoriteQuick: () => void;
  sortOrder: SortOrderType;
  onSortChange: (order: SortOrderType) => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  isHorizontal = false,
  activeFilterCount,
  onOpenFilters,
  onClearAll,
  isInstalledQuickActive,
  onToggleInstalledQuick,
  isFavoriteQuickActive,
  onToggleFavoriteQuick,
  sortOrder,
  onSortChange,
}) => {
  const hasModalFilters = activeFilterCount > 0;
  const headerItemProps = isHorizontal ? { 'data-gamepad-header-item': true } : {};

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex">
        <Button
          variant="filter"
          onClick={onOpenFilters}
          {...headerItemProps}
          className={`
            !transition-[color,background-color,border-color]
          ${hasModalFilters ? '!bg-glass-hover !text-text-main !border-border-hover rounded-r-none' : ''}
        `}
        >
          <SlidersHorizontal size={14} />
          <span>Фільтри</span>
          {hasModalFilters && (
            <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-color-accent text-text-dark text-xs font-semibold">
              {activeFilterCount}
            </span>
          )}
        </Button>

        {hasModalFilters && (
          <Button
            variant="filter"
            onClick={onClearAll}
            {...headerItemProps}
            className={'rounded-l-none'}
            title="Очистити всі фільтри"
          >
            <X size={14} />
          </Button>
        )}
      </div>

      <SortDropdown
        isHorizontal={isHorizontal}
        sortOrder={sortOrder}
        onSortChange={onSortChange}
      />

      <div className="flex-1 justify-end flex gap-2">
        <Button
          variant="filter"
          title={`${
            isInstalledQuickActive ? 'Приховати' : 'Показати'
          } завантажені переклади`}
          onClick={onToggleInstalledQuick}
          {...headerItemProps}
          className={
            isInstalledQuickActive
              ? '!bg-glass-hover !text-text-main !border-border-hover'
              : ''
          }
        >
          <Download size={14} />
        </Button>
        <Button
          variant="filter"
          title={`${isFavoriteQuickActive ? 'Приховати' : 'Показати'} улюблене`}
          onClick={onToggleFavoriteQuick}
          {...headerItemProps}
          className={
            isFavoriteQuickActive
              ? '!bg-glass-hover !text-text-main !border-border-hover'
              : ''
          }
        >
          <Bookmark size={14} />
        </Button>
      </div>
    </div>
  );
};
