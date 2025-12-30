import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ListFilter, Check, X } from 'lucide-react';
import { STATUS_OPTIONS, SPECIAL_FILTER_OPTIONS, type SpecialFilterType } from './types';

interface StatusFilterDropdownProps {
  selectedStatuses: string[];
  onStatusesChange: (statuses: string[]) => void;
  specialFilter: SpecialFilterType | null;
  onSpecialFilterChange: (filter: SpecialFilterType | null) => void;
}

export const StatusFilterDropdown: React.FC<StatusFilterDropdownProps> = React.memo(
  ({ selectedStatuses, onStatusesChange, specialFilter, onSpecialFilterChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Determine current label
    const currentLabel = useMemo(() => {
      if (specialFilter) {
        const option = SPECIAL_FILTER_OPTIONS.find((o) => o.value === specialFilter);
        return option?.label || specialFilter;
      }
      if (selectedStatuses.length === 0) return 'Усі стани';
      if (selectedStatuses.length === 1) {
        const option = STATUS_OPTIONS.find((o) => o.value === selectedStatuses[0]);
        return option?.label || selectedStatuses[0];
      }
      return `${selectedStatuses.length} стани`;
    }, [selectedStatuses, specialFilter]);

    const hasActiveFilter = specialFilter !== null || selectedStatuses.length > 0;

    // Close menu on outside click
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };

      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
      }

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [isOpen]);

    // Toggle status selection
    const handleStatusToggle = useCallback(
      (status: string) => {
        if (selectedStatuses.includes(status)) {
          onStatusesChange(selectedStatuses.filter((s) => s !== status));
        } else {
          onStatusesChange([...selectedStatuses, status]);
        }
      },
      [selectedStatuses, onStatusesChange]
    );

    // Handle special filter selection
    const handleSpecialFilterSelect = useCallback(
      (filter: SpecialFilterType) => {
        onSpecialFilterChange(filter);
        setIsOpen(false);
      },
      [onSpecialFilterChange]
    );

    // Clear all filters
    const handleClearAll = useCallback(() => {
      onStatusesChange([]);
      onSpecialFilterChange(null);
    }, [onStatusesChange, onSpecialFilterChange]);

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
              {/* Clear filter button */}
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

              {/* Status options with checkboxes */}
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
                          ? 'bg-neon-blue border-neon-blue'
                          : 'border-text-muted'
                      }`}
                    >
                      {isSelected && <Check size={12} className="text-white" />}
                    </span>
                    <span>{option.label}</span>
                  </button>
                );
              })}

              {/* Separator */}
              <div className="border-t border-border my-1" />

              {/* Special filters (single select) */}
              {SPECIAL_FILTER_OPTIONS.map((option) => {
                const isSelected = specialFilter === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => handleSpecialFilterSelect(option.value)}
                    data-gamepad-dropdown-item
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
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
