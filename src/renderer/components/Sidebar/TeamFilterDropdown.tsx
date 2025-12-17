import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Check, Search, X } from 'lucide-react';

interface TeamFilterDropdownProps {
  value: string | null;
  onChange: (value: string | null) => void;
  teams: string[];
  isLoading?: boolean;
}

export const TeamFilterDropdown: React.FC<TeamFilterDropdownProps> = React.memo(
  ({ value, onChange, teams, isLoading }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const menuRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const currentLabel = value || 'Усі автори';

    // Filter teams based on search
    const filteredTeams = useMemo(() => {
      if (!search.trim()) return teams;
      const searchLower = search.toLowerCase();
      return teams.filter((team) => team.toLowerCase().includes(searchLower));
    }, [teams, search]);

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

    // Focus search input when dropdown opens
    useEffect(() => {
      if (isOpen && searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, [isOpen]);

    const handleSelect = useCallback(
      (team: string | null) => {
        onChange(team);
        setIsOpen(false);
        setSearch('');
      },
      [onChange]
    );

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
            value !== null
              ? 'bg-glass-hover text-white border border-border-hover'
              : 'bg-glass text-text-muted border border-transparent hover:bg-glass-hover hover:text-white'
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
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                <Search size={14} className="text-text-muted flex-shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Пошук автора..."
                  className="flex-1 bg-transparent text-sm text-white placeholder-text-muted outline-none"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="text-text-muted hover:text-white transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Teams list */}
              <div className="max-h-[240px] overflow-y-auto custom-scrollbar py-1">
                {isLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="w-5 h-5 border-2 border-text-muted border-t-white rounded-full animate-spin" />
                  </div>
                ) : (
                  <>
                    {/* "All teams" option - only show when not searching */}
                    {!search && (
                      <button
                        onClick={() => handleSelect(null)}
                        data-gamepad-dropdown-item
                        className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                          value === null
                            ? 'bg-glass-hover text-white'
                            : 'text-text-muted hover:bg-glass hover:text-white'
                        } focus:outline-none focus:bg-glass-hover focus:text-white`}
                      >
                        Усі автори
                        {value === null && <Check size={14} />}
                      </button>
                    )}

                    {filteredTeams.length === 0 ? (
                      <div className="text-center text-text-muted py-4 text-sm">
                        Автора не знайдено
                      </div>
                    ) : (
                      filteredTeams.map((team) => (
                        <button
                          key={team}
                          onClick={() => handleSelect(team)}
                          data-gamepad-dropdown-item
                          className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                            value === team
                              ? 'bg-glass-hover text-white'
                              : 'text-text-muted hover:bg-glass hover:text-white'
                          } focus:outline-none focus:bg-glass-hover focus:text-white`}
                        >
                          <span className="truncate">{team}</span>
                          {value === team && <Check size={14} />}
                        </button>
                      ))
                    )}
                  </>
                )}
              </div>

              {/* Footer with count */}
              {!isLoading && teams.length > 0 && (
                <div className="px-3 py-2 border-t border-border text-xs text-text-muted text-center">
                  {search ? `Знайдено: ${filteredTeams.length}` : `Всього: ${teams.length}`}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);
