import { AnimatePresence, motion } from 'framer-motion';
import { Check, ListFilter, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FilterCounts } from '../../hooks/useFilterCounts';
import {
  SORT_OPTIONS,
  type SortOrderType,
  SPECIAL_FILTER_OPTIONS,
  type SpecialFilterType,
  STATUS_OPTIONS,
} from './types';

interface StatusFilterDropdownProps {
  selectedStatuses: string[];
  onStatusesChange: (statuses: string[]) => void;
  specialFilter: SpecialFilterType | null;
  onSpecialFilterChange: (filter: SpecialFilterType | null) => void;
  counts?: FilterCounts;
  sortOrder: SortOrderType;
  onSortChange: (order: SortOrderType) => void;
}

export const StatusFilterDropdown: React.FC<StatusFilterDropdownProps> = React.memo(
  ({
    selectedStatuses,
    onStatusesChange,
    specialFilter,
    onSpecialFilterChange,
    counts,
    sortOrder,
    onSortChange,
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const currentLabel = useMemo(() => {
      if (specialFilter) {
        return (
          SPECIAL_FILTER_OPTIONS.find((o) => o.value === specialFilter)?.label ||
          specialFilter
        );
      }
      if (selectedStatuses.length === 0) return 'Усі стани';
      if (selectedStatuses.length === 1) {
        return (
          STATUS_OPTIONS.find((o) => o.value === selectedStatuses[0])?.label ||
          selectedStatuses[0]
        );
      }
      return `${selectedStatuses.length} стани`;
    }, [selectedStatuses, specialFilter]);

    const hasActiveFilter = specialFilter !== null || selectedStatuses.length > 0;

    useEffect(() => {
      if (!isOpen) return;
      const handleClickOutside = (e: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleStatusToggle = useCallback(
      (status: string) => {
        onStatusesChange(
          selectedStatuses.includes(status)
            ? selectedStatuses.filter((s) => s !== status)
            : [...selectedStatuses, status]
        );
      },
      [selectedStatuses, onStatusesChange]
    );

    const handleSpecialFilterSelect = useCallback(
      (filter: SpecialFilterType) => {
        onSpecialFilterChange(specialFilter === filter ? null : filter);
        setIsOpen(false);
      },
      [onSpecialFilterChange, specialFilter]
    );

    const handleClearAll = useCallback(() => {
      onStatusesChange([]);
      onSpecialFilterChange(null);
    }, [onStatusesChange, onSpecialFilterChange]);

    const handleSortChange = useCallback(
      (order: SortOrderType) => {
        onSortChange(order);
        setIsOpen(false);
      },
      [onSortChange]
    );

    return (
      <div className="relative flex-1 min-w-0" ref={menuRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
            hasActiveFilter
              ? 'bg-glass-hover text-text-main border border-border-hover'
              : 'bg-glass text-text-muted border border-transparent hover:bg-glass-hover hover:text-text-main'
          }`}
        >
          <span className="flex items-center gap-2 truncate">
            <ListFilter size={14} className="flex-shrink-0" />
            <span className="truncate">{currentLabel}</span>
          </span>
          <svg
            className={`w-4 h-4 transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full left-0 mt-1 py-1 w-[calc(200%+0.5rem)] bg-bg-dark border border-border rounded-lg shadow-xl z-50 overflow-hidden filter-dropdown"
              data-gamepad-dropdown
            >
              {hasActiveFilter && (
                <>
                  <button
                    onClick={handleClearAll}
                    data-gamepad-dropdown-item
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-muted hover:bg-glass hover:text-text-main transition-colors"
                  >
                    <X size={14} />
                    <span>Очистити фільтр</span>
                  </button>
                  <div className="border-t border-border my-1" />
                </>
              )}

              {STATUS_OPTIONS.map((option) => {
                const isSelected = selectedStatuses.includes(option.value);
                return (
                  <button
                    key={option.value}
                    onClick={() => handleStatusToggle(option.value)}
                    data-gamepad-dropdown-item
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                      isSelected
                        ? 'bg-glass-hover text-text-main'
                        : 'text-text-muted hover:bg-glass hover:text-text-main'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 flex-shrink-0 flex items-center justify-center rounded border ${
                        isSelected
                          ? 'bg-color-accent border-color-accent'
                          : 'border-text-muted'
                      }`}
                    >
                      {isSelected && <Check size={12} className="text-text-dark" />}
                    </span>
                    <span className="flex-1 text-left">{option.label}</span>
                    {counts?.[option.value] !== undefined && (
                      <span className="px-1.5 py-0.5 text-xs rounded-full bg-glass text-text-muted">
                        {counts[option.value]}
                      </span>
                    )}
                  </button>
                );
              })}

              <div className="border-t border-border my-1" />

              {SPECIAL_FILTER_OPTIONS.filter(
                (option) => !counts || counts[option.value] !== 0
              ).map((option) => {
                const isSelected = specialFilter === option.value;
                return (
                  <React.Fragment key={option.value}>
                    {option.value === 'with-achievements' && (
                      <div className="border-t border-border my-1" />
                    )}
                    <button
                      onClick={() => handleSpecialFilterSelect(option.value)}
                      data-gamepad-dropdown-item
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors text-left ${
                        isSelected
                          ? 'bg-glass-hover text-text-main'
                          : 'text-text-muted hover:bg-glass hover:text-text-main'
                      }`}
                    >
                      <span>{option.label}</span>
                      <span className="flex items-center gap-2">
                        {counts?.[option.value] !== undefined && (
                          <span className="px-1.5 py-0.5 text-xs rounded-full bg-glass text-text-muted">
                            {counts[option.value]}
                          </span>
                        )}
                        {isSelected && <Check size={14} />}
                      </span>
                    </button>
                  </React.Fragment>
                );
              })}

              <div className="border-t border-border my-1" />
              <div className="px-3 py-1 text-xs text-text-muted font-medium uppercase tracking-wider">
                Сортування
              </div>

              {SORT_OPTIONS.map((option) => {
                const isSelected = sortOrder === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => handleSortChange(option.value)}
                    data-gamepad-dropdown-item
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left transition-colors ${
                      isSelected
                        ? 'bg-glass-hover text-text-main'
                        : 'text-text-muted hover:bg-glass hover:text-text-main'
                    }`}
                  >
                    <span>{option.label}</span>
                    {isSelected && <Check size={14} />}
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);
