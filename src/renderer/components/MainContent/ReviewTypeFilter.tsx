import React from 'react';
import { t } from '@/shared/i18n/i18n';
import type { FeedbackType } from '@/shared/types';
import type { ReviewCounts } from '../../utils/reviewCounts';
import { ReviewFilterChip } from './ReviewFilterChip';

export type ReviewFilter = 'all' | FeedbackType;

interface ReviewTypeFilterProps {
  value: ReviewFilter | null;
  counts: ReviewCounts;
  onChange: (filter: ReviewFilter | null) => void;
}

const FILTERS: ReviewFilter[] = ['all', 'feedback', 'error'];

export const ReviewTypeFilter: React.FC<ReviewTypeFilterProps> = ({
  value,
  counts,
  onChange,
}) => (
  <div className="flex flex-wrap items-center gap-2">
    {FILTERS.map((filter) => (
      <ReviewFilterChip
        key={filter}
        label={t(`gameReviews.filter.${filter}`)}
        count={counts[filter]}
        isActive={value === filter}
        onClick={() => onChange(value === filter ? null : filter)}
      />
    ))}
  </div>
);
