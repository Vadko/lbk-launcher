import { MessagesSquareIcon, PencilIcon } from 'lucide-react';
import { t } from '@/shared/i18n/i18n';
import type { ReviewCounts } from '../../utils/reviewCounts';
import { Button } from '../ui/Button';

interface ReviewsHeaderProps {
  reviewCounts: ReviewCounts;
  canLeaveFeedback: boolean;
  onLeaveFeedback: () => void;
}

export function ReviewsHeader({
  reviewCounts,
  canLeaveFeedback,
  onLeaveFeedback,
}: ReviewsHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <MessagesSquareIcon size={24} className="shrink-0 text-color-main" />
        <h3 className="text-lg font-bold leading-6 text-white">
          {t('gameReviews.title')}
        </h3>
        {reviewCounts.all > 0 && (
          <span className="px-2.5 py-0.5 rounded-full bg-color-main/15 text-sm font-semibold text-color-main tabular-nums">
            {reviewCounts.all}
          </span>
        )}
      </div>
      {canLeaveFeedback && (
        <Button
          type="button"
          variant="primary"
          width="narrow"
          onClick={onLeaveFeedback}
          data-gamepad-action
          icon={<PencilIcon size={16} />}
        >
          {t('gameReviews.write')}
        </Button>
      )}
    </div>
  );
}
