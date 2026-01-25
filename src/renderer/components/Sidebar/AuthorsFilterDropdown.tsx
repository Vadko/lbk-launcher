import { AnimatePresence, motion } from 'framer-motion';
import { Check, Search, Users, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGamepadModeStore } from '../../store/useGamepadModeStore';

interface AuthorsFilterDropdownProps {
  selectedAuthors: string[];
  onAuthorsChange: (authors: string[]) => void;
  authors: string[];
  isLoading?: boolean;
}

export const AuthorsFilterDropdown: React.FC<AuthorsFilterDropdownProps> = React.memo(
  ({ selectedAuthors, onAuthorsChange, authors, isLoading }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const menuRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const isComposingRef = useRef(false);
    // Deduplication for Gamescope virtual keyboard: fires two input events per keypress
    const lastInputDataRef = useRef<string | null>(null);
    const lastInputTimeRef = useRef(0);
    const isGamepadMode = useGamepadModeStore((s) => s.isGamepadMode);

    // Determine current label
    const currentLabel = useMemo(() => {
      if (selectedAuthors.length === 0) return 'Усі автори';
      if (selectedAuthors.length === 1) return selectedAuthors[0];
      return `${selectedAuthors.length} авторів`;
    }, [selectedAuthors]);

    const hasActiveFilter = selectedAuthors.length > 0;

    // Filter authors based on search
    const filteredAuthors = useMemo(() => {
      if (!search.trim()) return authors;
      const searchLower = search.toLowerCase();
      return authors.filter((author) => author.toLowerCase().includes(searchLower));
    }, [authors, search]);

    // Close menu on outside click
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

    // Focus search input when dropdown opens (skip in gamepad mode)
    useEffect(() => {
      if (isOpen && searchInputRef.current && !isGamepadMode) {
        searchInputRef.current.focus();
      }
    }, [isOpen, isGamepadMode]);

    // Toggle author selection
    const handleAuthorToggle = useCallback(
      (author: string) => {
        if (selectedAuthors.includes(author)) {
          onAuthorsChange(selectedAuthors.filter((a) => a !== author));
        } else {
          onAuthorsChange([...selectedAuthors, author]);
        }
      },
      [selectedAuthors, onAuthorsChange]
    );

    // Clear all selected authors
    const handleClearAll = useCallback(() => {
      onAuthorsChange([]);
    }, [onAuthorsChange]);

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
          <span className="flex items-center gap-2 truncate">
            <Users size={14} className="flex-shrink-0" />
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
              className="absolute top-full right-0 mt-1 w-[calc(200%+0.5rem)] bg-bg-dark border border-border rounded-lg shadow-xl z-50 overflow-hidden filter-dropdown"
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
                  type="text"
                  value={search}
                  onBeforeInput={(e) => {
                    const inputEvent = e.nativeEvent as InputEvent;
                    if (inputEvent.inputType === 'insertText' && inputEvent.data) {
                      const now = Date.now();
                      if (
                        inputEvent.data === lastInputDataRef.current &&
                        now - lastInputTimeRef.current < 50
                      ) {
                        e.preventDefault();
                        return;
                      }
                      lastInputDataRef.current = inputEvent.data;
                      lastInputTimeRef.current = now;
                    }
                  }}
                  onChange={(e) => {
                    if (isComposingRef.current) return;
                    setSearch(e.target.value);
                  }}
                  onCompositionStart={() => {
                    isComposingRef.current = true;
                  }}
                  onCompositionEnd={(e) => {
                    isComposingRef.current = false;
                    setSearch(e.currentTarget.value);
                  }}
                  placeholder="Пошук автора..."
                  className="flex-1 bg-transparent text-sm text-text-main placeholder-text-muted outline-none"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="text-text-muted hover:text-text-main transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Authors list */}
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
                          <span>Очистити фільтр ({selectedAuthors.length})</span>
                        </button>
                        <div className="border-t border-border my-1" />
                      </>
                    )}

                    {filteredAuthors.length === 0 ? (
                      <div className="text-center text-text-muted py-4 text-sm">
                        Автора не знайдено
                      </div>
                    ) : (
                      filteredAuthors.map((author) => {
                        const isSelected = selectedAuthors.includes(author);
                        return (
                          <button
                            key={author}
                            onClick={() => handleAuthorToggle(author)}
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
                            <span className="truncate">{author}</span>
                          </button>
                        );
                      })
                    )}
                  </>
                )}
              </div>

              {/* Footer with count */}
              {!isLoading && authors.length > 0 && (
                <div className="px-3 py-2 border-t border-border text-xs text-text-muted text-center">
                  {search
                    ? `Знайдено: ${filteredAuthors.length}`
                    : `Всього: ${authors.length}`}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);
