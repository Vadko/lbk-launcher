import { Gamepad2Icon, InfoIcon, type LucideIcon, MessageSquareIcon } from 'lucide-react';
import React from 'react';
import { t } from '@/shared/i18n/i18n';
import { useHasReviewNotices } from '../../hooks/useHasReviewNotices';
import type { ReviewCounts } from '../../utils/reviewCounts';
import { Tooltip } from '../ui/Tooltip';

export type GameTab = 'info' | 'recommended' | 'reviews';

interface GameTabsProps {
  gameId: string;
  reviewCounts: ReviewCounts;
  tabs: GameTab[];
  activeTab: GameTab;
  onChange: (tab: GameTab) => void;
}

const TAB_ICONS: Record<GameTab, LucideIcon> = {
  info: InfoIcon,
  recommended: Gamepad2Icon,
  reviews: MessageSquareIcon,
};

export const GameTabs: React.FC<GameTabsProps> = ({
  gameId,
  reviewCounts,
  tabs,
  activeTab,
  onChange,
}) => {
  const hasReviewNotices = useHasReviewNotices(gameId);

  return (
    <div
      role="tablist"
      className="inline-flex shrink-0 gap-1 p-1 rounded-xl border border-white/10 bg-white/5"
    >
      {tabs.map((tab) => {
        const Icon = TAB_ICONS[tab];
        const isActive = activeTab === tab;
        return (
          <Tooltip key={tab} content={t(`gameTabs.${tab}`)}>
            <button
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab)}
              data-gamepad-action
              className={`flex items-center gap-1.5 p-3 rounded-[9px] transition-colors ${
                isActive
                  ? 'bg-white/10 text-text-main'
                  : 'text-text-muted hover:text-text-main hover:bg-white/5'
              }`}
            >
              <span className="sr-only">{t(`gameTabs.${tab}`)}</span>
              <span className="relative inline-flex">
                <Icon size={20} aria-hidden />
                {tab === 'reviews' && hasReviewNotices && (
                  <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-color-accent">
                    <span className="sr-only">{t('gameTabs.reviewsNews')}</span>
                  </span>
                )}
              </span>
              {tab === 'reviews' && reviewCounts.all > 0 && (
                <span className="text-[13px] font-semibold leading-5 text-text-muted tabular-nums">
                  {reviewCounts.all}
                </span>
              )}
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
};
