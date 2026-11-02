import React from 'react';
import { t } from '@/shared/i18n/i18n';

export type GameTab = 'info' | 'recommended' | 'reviews';

interface GameTabsProps {
  tabs: GameTab[];
  activeTab: GameTab;
  onChange: (tab: GameTab) => void;
}

export const GameTabs: React.FC<GameTabsProps> = ({ tabs, activeTab, onChange }) => (
  <div
    role="tablist"
    className="glass-card-no-motion p-2! flex gap-2 w-fit justify-self-end"
  >
    {tabs.map((tab) => (
      <button
        key={tab}
        type="button"
        role="tab"
        aria-selected={activeTab === tab}
        onClick={() => onChange(tab)}
        data-gamepad-action
        className={`px-6 py-2 rounded-xl font-medium transition-all ${
          activeTab === tab
            ? 'bg-linear-to-r/srgb from-color-accent to-color-main text-text-dark'
            : 'bg-surface-elevated text-text-muted hover:text-text-main hover:bg-surface-elevated/80'
        }`}
      >
        {t(`gameTabs.${tab}`)}
      </button>
    ))}
  </div>
);
