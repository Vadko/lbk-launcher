import { motion } from 'framer-motion';
import { SearchIcon } from 'lucide-react';
import { t } from '@/shared/i18n/i18n';
import type { NameMatch, Suggestion } from './ratingsFilter';

interface RatingsSuggestionsProps<T> {
  query: string;
  suggestions: readonly Suggestion<T>[];
  getName: (item: T) => string;
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
  query,
  suggestions,
  getName,
  onChoose,
}: RatingsSuggestionsProps<T>) => {
  const option = (index: number, label: React.ReactNode) => (
    <button
      key={index}
      type="button"
      data-suggestion
      data-gamepad-dropdown-item
      onClick={() => onChoose(index)}
      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-text-muted outline-hidden transition-colors hover:bg-glass hover:text-text-main focus:bg-glass-hover focus:text-text-main"
    >
      <SearchIcon size={16} className="shrink-0 text-text-muted" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.15 }}
      data-gamepad-dropdown
      className="absolute inset-x-0 top-full z-60 mt-1 overflow-hidden rounded-lg border border-border bg-bg-dark shadow-xl"
    >
      {suggestions.length === 0 ? (
        <div role="status" className="flex flex-col gap-1 px-3 py-4">
          <p className="text-sm font-semibold text-text-main">
            {t('ratings.search.noResults')}
          </p>
          <p className="text-sm text-text-muted">{t('ratings.search.noResultsHint')}</p>
        </div>
      ) : (
        <div className="flex flex-col py-1">
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
