import React from 'react';
import { PillTabs } from '../ui/PillTabs';

export type GameTab = 'info' | 'recommended' | 'reviews';

interface GameTabsProps {
  activeTab: GameTab;
  onChange: (tab: GameTab) => void;
}

const tabs: { id: GameTab; label: string }[] = [
  { id: 'info', label: 'Інфо' },
  { id: 'recommended', label: 'Рекомендовані' },
  { id: 'reviews', label: 'Відгуки' },
];

export const GameTabs: React.FC<GameTabsProps> = ({ activeTab, onChange }) => (
  <PillTabs
    tabs={tabs}
    activeTab={activeTab}
    onChange={onChange}
    className="justify-self-end"
  />
);
