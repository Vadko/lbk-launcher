import { G } from '@mobily/ts-belt';
import { AnimatePresence } from 'framer-motion';
import { SearchIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Input } from '../ui/Input';
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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => filterText(filter));
  const [open, setOpen] = useState(false);
  const query = text.trim();
  const suggestions = query ? suggest(items, getName, query) : [];

  // The gamepad closes a list by dispatching a mousedown on the body
  useEffect(() => {
    if (!open) {
      return;
    }
    const closeOutside = (e: MouseEvent) => {
      if (!(e.target instanceof Node) || !wrapperRef.current?.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', closeOutside);
    return () => document.removeEventListener('mousedown', closeOutside);
  }, [open]);

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

  const change = (value: string) => {
    setText(value);
    setOpen(value.trim() !== '');
    if (value.trim() === '' && G.isNotNullable(filter)) {
      onFilter(null);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // An IME uses Enter and the arrows to pick its candidates
    if (e.nativeEvent.isComposing) {
      return;
    }
    const input = inputRef.current;
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      // Focus first: a focus event after the close would open the list again
      input?.focus();
      setOpen(false);
    } else if (e.key === 'Enter' && e.target === input && query !== '') {
      e.preventDefault();
      choose(0);
    } else if (e.key === 'ArrowDown' && !open && query !== '') {
      e.preventDefault();
      setOpen(true);
    } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && open) {
      const stops = [
        input,
        ...e.currentTarget.querySelectorAll<HTMLElement>('[data-suggestion]'),
      ];
      const step = e.key === 'ArrowDown' ? 1 : -1;
      const from = stops.indexOf(document.activeElement as HTMLElement | null);
      const next = from === -1 ? undefined : stops[from + step];
      if (next) {
        e.preventDefault();
        next.focus();
      }
    }
  };

  return (
    <div
      ref={wrapperRef}
      onKeyDown={onKeyDown}
      // A null target is the gamepad blurring the field or a click on bare background, which the mousedown handler covers
      onBlur={(e) => {
        if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget)) {
          setOpen(false);
        }
      }}
      className="relative w-[400px] max-w-full"
    >
      <Input
        ref={inputRef}
        type="search"
        value={text}
        onChange={change}
        onFocus={() => setOpen(query !== '')}
        placeholder={placeholder}
        aria-label={placeholder}
        icon={<SearchIcon size={18} className="text-text-muted" />}
        data-gamepad-action
      />
      <AnimatePresence>
        {open && (
          <RatingsSuggestions
            query={query}
            suggestions={suggestions}
            getName={getName}
            onChoose={choose}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
