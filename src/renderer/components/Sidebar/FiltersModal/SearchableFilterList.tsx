import { Check, Search } from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useGamepadModeStore } from '../../../store/useGamepadModeStore';

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
  const isGamepadMode = useGamepadModeStore((s) => s.isGamepadMode);

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

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border focus-within:bg-glass-hover">
        <Search size={14} className="text-text-muted flex-shrink-0" />
        <input
          ref={searchInputRef}
          type="search"
          data-gamepad-skip={isGamepadMode || undefined}
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

      <div className="max-h-[220px] overflow-y-auto custom-scrollbar py-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="w-5 h-5 border-2 border-text-muted border-t-white rounded-full animate-spin" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center text-text-muted py-4 text-sm">{emptyLabel}</div>
        ) : (
          filteredItems.map((item) => {
            const selected = isSelected(item.id);
            return (
              <button
                key={item.id}
                onClick={() => onToggle(item.id)}
                data-gamepad-modal-item
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
