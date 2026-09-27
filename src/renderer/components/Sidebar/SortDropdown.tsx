import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDownAZ,
  ArrowUpDown,
  Check,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../ui/Button';
import { SORT_OPTIONS, type SortOrderType } from './types';

const SORT_ICONS: Record<string, React.ReactNode> = {
  name: <ArrowDownAZ size={14} />,
  downloads: <TrendingUp size={14} />,
  subscribers: <Users size={14} />,
  newest: <Sparkles size={14} />,
};

interface SortDropdownProps {
  isHorizontal?: boolean;
  sortOrder: SortOrderType;
  onSortChange: (order: SortOrderType) => void;
}

export const SortDropdown: React.FC<SortDropdownProps> = ({
  isHorizontal = false,
  sortOrder,
  onSortChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleSelect = useCallback(
    (order: SortOrderType) => {
      onSortChange(order);
      setIsOpen(false);
    },
    [onSortChange]
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const headerItemProps = isHorizontal ? { 'data-gamepad-header-item': true } : {};

  return (
    <div className="relative" ref={menuRef}>
      <Button
        title="Сортування"
        variant="filter"
        onClick={() => setIsOpen((open) => !open)}
        {...headerItemProps}
      >
        <ArrowUpDown size={14} />
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            data-gamepad-dropdown
            className="absolute top-full left-0 mt-1 w-56 bg-bg-dark border border-border rounded-lg shadow-xl z-50 overflow-hidden filter-dropdown"
          >
            <div className="py-1">
              {SORT_OPTIONS.map((option) => {
                const selected = sortOrder === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => handleSelect(option.value)}
                    data-gamepad-dropdown-item
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                      selected
                        ? 'bg-glass-hover text-text-main'
                        : 'text-text-muted hover:bg-glass hover:text-text-main'
                    }`}
                  >
                    {selected ? <Check size={14} /> : SORT_ICONS[option.value]}
                    <span className="flex-1">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
