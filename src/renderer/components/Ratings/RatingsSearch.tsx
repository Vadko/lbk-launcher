import { AnimatePresence, motion } from 'framer-motion';
import { SearchIcon } from 'lucide-react';
import React, { useId, useRef, useState } from 'react';
import { t } from '@/shared/i18n/i18n';
import { useCompositionSafeChange } from '../../hooks/useCompositionSafeChange';
import { ClearIcon } from '../Icons/ClearIcon';
import { optionId } from './optionId';
import { RatingsSuggestions } from './RatingsSuggestions';
import { type RatingsFilter, suggest } from './ratingsFilter';

interface RatingsSearchProps<T> {
  items: readonly T[];
  getKey: (item: T) => string;
  getName: (item: T) => string;
  filter: RatingsFilter | null;
  onFilter: (filter: RatingsFilter | null) => void;
  placeholder: string;
}

const filterText = (filter: RatingsFilter | null) =>
  filter === null ? '' : filter.kind === 'query' ? filter.text : filter.name;

export const RatingsSearch = <T,>({
  items,
  getKey,
  getName,
  filter,
  onFilter,
  placeholder,
}: RatingsSearchProps<T>) => {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => filterText(filter));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const query = text.trim();
  const isOpen = open && query !== '';
  const suggestions = query ? suggest(items, getName, query) : [];
  const optionCount = suggestions.length === 0 ? 0 : suggestions.length + 1;
  // The store reloads on catalog events, so the list can shrink under the highlighted row
  const current = Math.min(active, Math.max(optionCount - 1, 0));

  const commit = (next: RatingsFilter) => {
    setText(filterText(next));
    setOpen(false);
    inputRef.current?.blur();
    onFilter(next);
  };

  const choose = (index: number) => {
    const picked = suggestions[index - 1];
    commit(
      picked
        ? { kind: 'item', key: getKey(picked.item), name: getName(picked.item) }
        : { kind: 'query', text: query }
    );
  };

  const change = useCompositionSafeChange((value) => {
    setText(value);
    setActive(0);
    setOpen(value.trim() !== '');
    if (value.trim() === '' && filter !== null) {
      onFilter(null);
    }
  });

  const clear = () => {
    setText('');
    setOpen(false);
    if (filter !== null) {
      onFilter(null);
    }
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // An IME uses Enter and the arrows to pick its candidates
    if (e.nativeEvent.isComposing) {
      return;
    }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && optionCount > 0) {
      e.preventDefault();
      setOpen(true);
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((current + step + optionCount) % optionCount);
    } else if (e.key === 'Enter' && query !== '') {
      e.preventDefault();
      choose(isOpen && optionCount > 0 ? current : 0);
    } else if (e.key === 'Escape' && isOpen) {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div
      // Gamepad B blurs the field without a click, so leaving focus is what closes the list
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setOpen(false);
        }
      }}
      className="relative w-[400px] max-w-full"
    >
      <div className="group flex items-center gap-4 rounded-xl border border-border bg-glass px-[17px] py-[13px] backdrop-blur-[8px] transition-colors hover:border-white/20 focus-within:border-color-main!">
        <SearchIcon
          size={24}
          className={`shrink-0 transition-colors group-focus-within:text-color-main ${text ? 'text-color-main' : 'text-text-muted'}`}
        />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-label={placeholder}
          aria-expanded={isOpen && optionCount > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            isOpen && optionCount > 0 ? optionId(listId, current) : undefined
          }
          value={text}
          {...change}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          data-gamepad-action
          className="min-w-0 flex-1 bg-transparent text-base text-text-main caret-color-main outline-hidden placeholder:text-text-muted"
        />
        <AnimatePresence>
          {text && (
            <motion.button
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.12 }}
              type="button"
              onClick={clear}
              aria-label={t('ratings.search.clear')}
              data-gamepad-action
              className="shrink-0 text-text-muted transition-colors hover:text-text-main"
            >
              <ClearIcon />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {isOpen && (
          <RatingsSuggestions
            id={listId}
            query={query}
            suggestions={suggestions}
            getName={getName}
            active={current}
            onActive={setActive}
            onChoose={choose}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
