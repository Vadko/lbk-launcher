import { G } from '@mobily/ts-belt';
import { AnimatePresence } from 'framer-motion';
import { SearchIcon } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { useCloseOnOutsideMouseDown } from '../../hooks/useCloseOnOutsideMouseDown';
import { Input } from '../ui/Input';
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
  G.isNullable(filter) ? '' : filter.kind === 'query' ? filter.text : filter.name;

export const RatingsSearch = <T,>({
  items,
  getKey,
  getName,
  filter,
  onFilter,
  placeholder,
}: RatingsSearchProps<T>) => {
  const listId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState(() => filterText(filter));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const query = text.trim();
  const suggestions = query ? suggest(items, getName, query) : [];
  const optionCount = suggestions.length && suggestions.length + 1;
  // The store reloads on catalog events, so the list can shrink under the highlighted row
  const current = Math.min(active, optionCount - 1);
  const hasOptions = open && optionCount > 0;

  useCloseOnOutsideMouseDown(wrapperRef, open, () => setOpen(false));

  const commit = (next: RatingsFilter) => {
    setText(filterText(next));
    setOpen(false);
    onFilter(next);
  };

  const choose = (index: number) => {
    const suggestion = suggestions[index - 1];
    commit(
      G.isNullable(suggestion)
        ? { kind: 'query', text: query }
        : { kind: 'item', key: getKey(suggestion.item), name: getName(suggestion.item) }
    );
  };

  const change = (value: string) => {
    setText(value);
    setActive(0);
    setOpen(value.trim() !== '');
    if (value.trim() === '' && G.isNotNullable(filter)) {
      onFilter(null);
    }
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
      choose(hasOptions ? current : 0);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div
      ref={wrapperRef}
      // Gamepad B blurs the field with no new focus and keeps the list to pick from, unless it has nothing to pick or the window lost focus
      onBlur={(e) => {
        const next = e.relatedTarget;
        const leaves = next
          ? !e.currentTarget.contains(next)
          : !document.hasFocus() || optionCount === 0;
        if (leaves) {
          setOpen(false);
        }
      }}
      className="relative w-[400px] max-w-full"
    >
      <Input
        type="search"
        role="combobox"
        aria-label={placeholder}
        aria-expanded={hasOptions}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={hasOptions ? optionId(listId, current) : undefined}
        value={text}
        onChange={change}
        onFocus={() => setOpen(query !== '')}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        icon={<SearchIcon size={18} className="text-text-muted" />}
        data-gamepad-action
      />
      <AnimatePresence>
        {open && (
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
