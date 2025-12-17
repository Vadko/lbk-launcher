import React, { useRef, useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ListFilter, Check } from 'lucide-react';
import { FILTER_OPTIONS, type FilterType } from './types';

interface FilterDropdownProps {
  value: FilterType;
  onChange: (value: FilterType) => void;
}

export const FilterDropdown: React.FC<FilterDropdownProps> = React.memo(
  ({ value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const currentLabel = useMemo(
      () => FILTER_OPTIONS.find((f) => f.value === value)?.label || 'Усі ігри',
      [value]
    );

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

    return (
      <div className="relative flex-1 min-w-0" ref={menuRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
            value !== 'all'
              ? 'bg-glass-hover text-white border border-border-hover'
              : 'bg-glass text-text-muted border border-transparent hover:bg-glass-hover hover:text-white'
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
              {FILTER_OPTIONS.map((f, index) => (
                <React.Fragment key={f.value}>
                  {f.group === 'installed' &&
                    index > 0 &&
                    FILTER_OPTIONS[index - 1]?.group !== 'installed' && (
                      <div className="border-t border-border my-1" />
                    )}
                  <button
                    onClick={() => {
                      onChange(f.value);
                      setIsOpen(false);
                    }}
                    data-gamepad-dropdown-item
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                      value === f.value
                        ? 'bg-glass-hover text-white'
                        : 'text-text-muted hover:bg-glass hover:text-white'
                    } focus:outline-none focus:bg-glass-hover focus:text-white`}
                  >
                    {f.label}
                    {value === f.value && <Check size={14} />}
                  </button>
                </React.Fragment>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);
