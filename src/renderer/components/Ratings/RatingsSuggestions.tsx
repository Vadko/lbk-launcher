import { motion } from 'framer-motion';
import { SearchIcon } from 'lucide-react';
import type React from 'react';
import { t } from '@/shared/i18n/i18n';
import { optionId } from './optionId';
import type { NameMatch, Suggestion } from './ratingsFilter';

interface RatingsSuggestionsProps<T> {
  id: string;
  query: string;
  suggestions: Suggestion<T>[];
  getName: (item: T) => string;
  active: number;
  onActive: (index: number) => void;
  onChoose: (index: number) => void;
}

// The match reads plain and the rest of the name bold, as in a search engine's suggestions
const highlighted = (name: string, { start, end }: NameMatch) => (
  <>
    <span className="font-semibold text-text-main">{name.slice(0, start)}</span>
    <span className="text-text-main/80">{name.slice(start, end)}</span>
    <span className="font-semibold text-text-main">{name.slice(end)}</span>
  </>
);

export const RatingsSuggestions = <T,>({
  id,
  query,
  suggestions,
  getName,
  active,
  onActive,
  onChoose,
}: RatingsSuggestionsProps<T>) => {
  const option = (index: number, label: React.ReactNode) => (
    <button
      key={index}
      id={optionId(id, index)}
      type="button"
      role="option"
      aria-selected={index === active}
      tabIndex={-1}
      data-gamepad-action
      // Keeps the focus in the field, so a click does not close the list before it lands
      onMouseDown={(e) => e.preventDefault()}
      onMouseEnter={() => onActive(index)}
      onClick={() => onChoose(index)}
      className="relative flex h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-base"
    >
      {index === active && (
        <motion.span
          layoutId={`${id}-active`}
          transition={{ type: 'spring', stiffness: 600, damping: 45 }}
          className="absolute inset-0 rounded-lg bg-white/5"
        />
      )}
      <SearchIcon size={20} className="relative shrink-0 text-text-muted" />
      <span className="relative min-w-0 flex-1 truncate">{label}</span>
    </button>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="absolute inset-x-0 top-full z-30 mt-2 origin-top overflow-hidden rounded-xl border border-border bg-card shadow-[0_12px_32px_rgba(0,0,0,0.4)]"
    >
      {suggestions.length === 0 ? (
        <div role="status" className="flex flex-col gap-1 px-5 py-4">
          <p className="text-base font-semibold text-text-main">
            {t('ratings.search.noResults')}
          </p>
          <p className="text-sm text-text-muted">{t('ratings.search.noResultsHint')}</p>
        </div>
      ) : (
        <div id={id} role="listbox" className="flex flex-col gap-0.5 p-2">
          {option(
            0,
            <>
              <span className="font-semibold text-text-main">{query}</span>
              <span className="text-text-muted"> {t('ratings.search.allResults')}</span>
            </>
          )}
          {suggestions.map((suggestion, index) =>
            option(index + 1, highlighted(getName(suggestion.item), suggestion.match))
          )}
        </div>
      )}
    </motion.div>
  );
};
