import { Check, Search } from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';

interface SearchableFilterItem {
  id: string | number;
  label: string;
  count?: number;
}

interface SearchableFilterListProps {
  items: SearchableFilterItem[];
  selectedIds: Array<string | number>;
  onToggle: (id: string | number) => void;
  isLoading?: boolean;
  searchPlaceholder: string;
  emptyLabel: string;
}

export const SearchableFilterList: React.FC<SearchableFilterListProps> = ({
  items,
  selectedIds,
  onToggle,
  isLoading,
  searchPlaceholder,
  emptyLabel,
}) => {
  const [search, setSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isComposingRef = useRef(false);

  // Gamepad model: the whole list is one navigable "stop" (data-gamepad-modal-item
  // on the container). A drills into it - real DOM focus moves onto its first row,
  // so up/down between rows and A-to-toggle work through the generic modal
  // navigation as normal - and B (data-gamepad-drill-back) steps back out to the
  // list stop instead of closing the whole filters modal. Otherwise, reaching a
  // single author/tag would mean paging through every row one at a time.
  const [isDrilledIn, setIsDrilledIn] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const firstRowRef = useRef<HTMLButtonElement>(null);

  const filteredItems = useMemo(() => {
    if (!search.trim()) {
      return items;
    }
    const searchLower = search.toLowerCase();
    return items.filter((item) => item.label.toLowerCase().includes(searchLower));
  }, [items, search]);

  const isSelected = useCallback(
    (id: string | number) => selectedIds.includes(id),
    [selectedIds]
  );

  // Focus moves synchronously in the click handlers below (not via a
  // useEffect keyed on isDrilledIn) - an effect runs after React commits,
  // asynchronously relative to the gamepad poll, which raced the poll seeing
  // the updated data-gamepad-skip attributes before focus had actually moved.
  const enterList = useCallback(() => {
    firstRowRef.current?.focus();
    setIsDrilledIn(true);
  }, []);

  const exitList = useCallback(() => {
    listRef.current?.focus();
    setIsDrilledIn(false);
  }, []);

  return (
    <div className="searchable-filter-list border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border focus-within:bg-glass-hover">
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
          placeholder={searchPlaceholder}
          className="flex-1 bg-transparent text-sm text-text-main placeholder-text-muted outline-none"
        />
      </div>

      <div
        ref={listRef}
        tabIndex={-1}
        data-gamepad-modal-item
        data-gamepad-skip={isDrilledIn || undefined}
        onClick={() => !isDrilledIn && enterList()}
        className="max-h-[220px] overflow-y-auto custom-scrollbar py-1 outline-none"
      >
        {isDrilledIn && (
          <button
            type="button"
            data-gamepad-drill-back
            onClick={exitList}
            tabIndex={-1}
            aria-hidden="true"
            className="hidden"
          />
        )}
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="w-5 h-5 border-2 border-text-muted border-t-white rounded-full animate-spin" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center text-text-muted py-4 text-sm">{emptyLabel}</div>
        ) : (
          filteredItems.map((item, index) => {
            const selected = isSelected(item.id);
            return (
              <button
                key={item.id}
                ref={index === 0 ? firstRowRef : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(item.id);
                }}
                data-gamepad-modal-item
                data-gamepad-skip={isDrilledIn ? undefined : true}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                  selected
                    ? 'bg-glass-hover text-text-main'
                    : 'text-text-muted hover:bg-glass hover:text-text-main'
                }`}
                title={item.label}
              >
                <span
                  className={`w-4 h-4 flex-shrink-0 flex items-center justify-center rounded border ${
                    selected ? 'bg-color-accent border-color-accent' : 'border-text-muted'
                  }`}
                >
                  {selected && <Check size={12} className="text-text-dark" />}
                </span>
                <span className="truncate flex-1 text-left">{item.label}</span>
                {item.count !== undefined && (
                  <span className="text-xs text-text-muted flex-shrink-0">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
