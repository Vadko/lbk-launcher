import { BanIcon } from 'lucide-react';
import { t } from '@/shared/i18n/i18n';

interface ReviewRemovedEntryProps {
  id: string;
}

// Stands in for a removed reply so the answers under it keep their place; its height leaves the gap an entry leaves under its avatar
export function ReviewRemovedEntry({ id }: ReviewRemovedEntryProps) {
  return (
    <article
      id={`review-${id}`}
      className="flex items-start gap-4 min-h-10 min-w-0 rounded-xl"
    >
      <span
        aria-hidden
        className="shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-glass border border-border text-text-muted"
      >
        <BanIcon size={14} />
      </span>
      <p className="text-sm leading-7 italic text-text-muted">
        {t('gameReviews.removed')}
      </p>
    </article>
  );
}
