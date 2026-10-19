import React from 'react';
import { t } from '@/shared/i18n/i18n';

interface StatusBadgeProps {
  status: 'completed' | 'in-progress' | 'planned' | 'tech-improvement';
  className?: string;
  style?: 'capsule' | 'text';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  className = '',
  style = 'text',
}) => {
  const badgeConfig = {
    completed: {
      textLabel: t('gameStatus.completed'),
      capsuleColor: 'bg-[rgba(168,207,150,0.25)]',
      textColor: 'text-color-main',
    },
    'in-progress': {
      textLabel: t('gameStatus.inProgress'),
      capsuleColor: 'bg-[rgba(255,164,122,0.25)]',
      textColor: 'text-color-accent',
    },
    planned: {
      textLabel: t('gameStatus.planned'),
      capsuleColor: 'bg-[rgba(239,238,173,0.25)]',
      textColor: 'text-color-mixed',
    },
    'tech-improvement': {
      textLabel: t('gameStatus.techImprovement'),
      capsuleColor: 'bg-[rgba(148,163,184,0.25)]',
      textColor: 'text-white',
    },
    unknown: {
      textLabel: t('statusBadge.unknown'),
      capsuleColor: 'bg-[rgba(255,164,122,0.25)]',
      textColor: 'text-color-accent',
    },
  };

  const config = badgeConfig[status] || badgeConfig['unknown'];

  return (
    <span
      className={`${className} ${config.textColor} ${
        style === 'capsule' ? `py-1 px-2  rounded-xl ${config.capsuleColor}` : ''
      }`}
    >
      {config.textLabel}
    </span>
  );
};
