import { MessagesSquareIcon, PencilIcon } from 'lucide-react';
import React from 'react';
import { t } from '@/shared/i18n/i18n';
import type { ReviewCounts } from '../../utils/reviewCounts';

interface ReviewsHeaderProps {
  reviewCounts: ReviewCounts;
  canLeaveFeedback: boolean;
  onLeaveFeedback: () => void;
}

export const ReviewsHeader: React.FC<ReviewsHeaderProps> = ({
  reviewCounts,
  canLeaveFeedback,
  onLeaveFeedback,
}) => (
  <div className="flex flex-wrap items-center justify-between gap-4">
    <div className="flex items-center gap-3">
      <MessagesSquareIcon size={24} className="shrink-0 text-color-main" />
      <h3 className="text-lg font-bold leading-6 text-white">{t('gameReviews.title')}</h3>
      {reviewCounts.all > 0 && (
        <span className="px-2.5 py-0.5 rounded-full bg-color-main/15 text-sm font-semibold text-color-main tabular-nums">
          {reviewCounts.all}
        </span>
      )}
    </div>
    {canLeaveFeedback && (
      <button
        type="button"
        onClick={onLeaveFeedback}
        data-gamepad-action
        className="flex items-center gap-2 px-[18px] py-2.5 rounded-[10px] bg-linear-to-r/srgb from-color-main to-color-mixed text-sm font-semibold text-text-dark transition-all hover:brightness-110"
      >
        <PencilIcon size={16} className="shrink-0" />
        {t('gameReviews.write')}
      </button>
    )}
  </div>
);
