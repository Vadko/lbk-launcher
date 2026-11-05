import React from 'react';
import { t } from '@/shared/i18n/i18n';
import type { FeedbackType } from '@/shared/types';
import type { ReviewCounts } from '../../utils/reviewCounts';
import { SlidingTabs } from '../ui/SlidingTabs';

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
  <SlidingTabs
    variant="chip"
    tabs={FILTERS}
    active={value}
    onChange={(filter) => onChange(value === filter ? null : filter)}
    label={(filter, isActive) => (
      <>
        <span className="font-semibold">{t(`gameReviews.filter.${filter}`)}</span>
        <span
          className={`font-normal tabular-nums ${isActive ? 'text-text-dark/60' : 'text-text-muted'}`}
        >
          {counts[filter]}
        </span>
      </>
    )}
  />
);
