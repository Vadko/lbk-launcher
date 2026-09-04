import { AnimatePresence, motion } from 'framer-motion';
import { Check, Search, Tags, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { plural } from '@/shared/plural';
import type { TagOption } from '@/shared/types';
import { useGamepadModeStore } from '../../store/useGamepadModeStore';

interface TagsFilterDropdownProps {
  selectedTagIds: number[];
  onTagsChange: (tagIds: number[]) => void;
  tags: TagOption[];
  isLoading?: boolean;
  wideMenu?: boolean;
}

export const TagsFilterDropdown: React.FC<TagsFilterDropdownProps> = React.memo(
  ({ selectedTagIds, onTagsChange, tags, isLoading, wideMenu = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const menuRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const isComposingRef = useRef(false);
    const isGamepadMode = useGamepadModeStore((s) => s.isGamepadMode);

    const currentLabel = useMemo(() => {
      if (selectedTagIds.length === 0) {
        return 'Усі категорії';
      }
      if (selectedTagIds.length === 1) {
        return tags.find((tag) => tag.tagid === selectedTagIds[0])?.name ?? 'Категорія';
      }
      return `${selectedTagIds.length} ${plural(selectedTagIds.length, 'категорія', 'категорії', 'категорій')}`;
    }, [selectedTagIds, tags]);

    const hasActiveFilter = selectedTagIds.length > 0;

    const filteredTags = useMemo(() => {
      if (!search.trim()) {
        return tags;
      }
      const searchLower = search.toLowerCase();
      return tags.filter((tag) => tag.name.toLowerCase().includes(searchLower));
    }, [tags, search]);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
          setIsOpen(false);
          setSearch('');
        }
      };

      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
      }

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [isOpen]);

    useEffect(() => {
      if (isOpen && searchInputRef.current && !isGamepadMode) {
        searchInputRef.current.focus();
      }
    }, [isOpen, isGamepadMode]);

    const handleTagToggle = useCallback(
      (tagId: number) => {
        if (selectedTagIds.includes(tagId)) {
          onTagsChange(selectedTagIds.filter((id) => id !== tagId));
        } else {
          onTagsChange([...selectedTagIds, tagId]);
        }
      },
      [selectedTagIds, onTagsChange]
    );

    const handleClearAll = useCallback(() => {
      onTagsChange([]);
    }, [onTagsChange]);

    const handleToggle = useCallback(() => {
      if (isOpen) {
        setSearch('');
      }
      setIsOpen(!isOpen);
    }, [isOpen]);

    return (
      <div className="relative flex-1 min-w-0" ref={menuRef}>
        <button
          onClick={handleToggle}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
            hasActiveFilter
              ? 'bg-glass-hover text-text-main border border-border-hover'
              : 'bg-glass text-text-muted border border-transparent hover:bg-glass-hover hover:text-text-main'
          }`}
        >
          <span className="flex items-center gap-2 truncate" title={currentLabel}>
            <Tags size={14} className="flex-shrink-0" />
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
              className={`absolute top-full mt-1 ${wideMenu ? 'right-0 w-[calc(200%+0.5rem)]' : 'left-0 w-full'} bg-bg-dark border border-border rounded-lg shadow-xl z-50 overflow-hidden filter-dropdown`}
              data-gamepad-dropdown
            >
              {/* Search input */}
              <div
                className="flex items-center gap-2 px-3 py-2 border-b border-border focus:bg-glass-hover"
                data-gamepad-dropdown-item
                tabIndex={0}
                onFocus={() => !isGamepadMode && searchInputRef.current?.focus()}
              >
                <Search size={14} className="text-text-muted flex-shrink-0" />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={search}
                  onChange={(e) => {
                    if (isComposingRef.current) {
                      return;
                    }
                    setSearch(e.target.value);
                  }}
                  onCompositionStart={() => {
                    isComposingRef.current = true;
                  }}
                  onCompositionEnd={(e) => {
                    isComposingRef.current = false;
                    setSearch(e.currentTarget.value);
                  }}
                  placeholder="Пошук категорії..."
                  className="flex-1 bg-transparent text-sm text-text-main placeholder-text-muted outline-none"
                />
              </div>

              {/* Tags list */}
              <div className="max-h-[240px] overflow-y-auto custom-scrollbar py-1">
                {isLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="w-5 h-5 border-2 border-text-muted border-t-white rounded-full animate-spin" />
                  </div>
                ) : (
                  <>
                    {/* Clear filter button - only show when not searching */}
                    {!search && hasActiveFilter && (
                      <>
                        <button
                          onClick={handleClearAll}
                          data-gamepad-dropdown-item
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-muted hover:bg-glass hover:text-text-main transition-colors"
                        >
                          <X size={14} />
                          <span>Очистити фільтр ({selectedTagIds.length})</span>
                        </button>
                        <div className="border-t border-border my-1" />
                      </>
                    )}

                    {filteredTags.length === 0 ? (
                      <div className="text-center text-text-muted py-4 text-sm">
                        Категорію не знайдено
                      </div>
                    ) : (
                      filteredTags.map((tag) => {
                        const isSelected = selectedTagIds.includes(tag.tagid);
                        return (
                          <button
                            key={tag.tagid}
                            onClick={() => handleTagToggle(tag.tagid)}
                            data-gamepad-dropdown-item
                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                              isSelected
                                ? 'bg-glass-hover text-text-main'
                                : 'text-text-muted hover:bg-glass hover:text-text-main'
                            }`}
                            title={tag.name}
                          >
                            <span
                              className={`w-4 h-4 flex-shrink-0 flex items-center justify-center rounded border ${
                                isSelected
                                  ? 'bg-color-accent border-color-accent'
                                  : 'border-text-muted'
                              }`}
                            >
                              {isSelected && (
                                <Check size={12} className="text-text-dark" />
                              )}
                            </span>
                            <span className="truncate flex-1 text-left">{tag.name}</span>
                            <span className="text-xs text-text-muted flex-shrink-0">
                              {tag.count}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </>
                )}
              </div>

              {/* Footer with count */}
              {!isLoading && tags.length > 0 && (
                <div className="px-3 py-2 border-t border-border text-xs text-text-muted text-center">
                  {search ? `Знайдено: ${filteredTags.length}` : `Усього: ${tags.length}`}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);
