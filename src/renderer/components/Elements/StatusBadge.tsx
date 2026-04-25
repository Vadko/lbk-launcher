import React from 'react';

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
      textLabel: 'Завершено',
      capsuleColor: 'bg-[rgba(168,207,150,0.25)]',
      textColor: 'text-color-main',
    },
    'in-progress': {
      textLabel: 'Ранній доступ',
      capsuleColor: 'bg-[rgba(255,164,122,0.25)]',
      textColor: 'text-color-accent',
    },
    planned: {
      textLabel: 'Заплановано',
      capsuleColor: 'bg-[rgba(239,238,173,0.25)]',
      textColor: 'text-color-mixed',
    },
    'tech-improvement': {
      textLabel: 'Технічна доробка',
      capsuleColor: 'bg-[rgba(148,163,184,0.25)]',
      textColor: 'text-[rgb(148,163,184)]',
    },
  };

  return (
    <span
      className={`${className} ${badgeConfig[status].textColor} ${
        style === 'capsule'
          ? `py-1 px-2  rounded-xl ${badgeConfig[status].capsuleColor}`
          : ''
      }`}
    >
      {badgeConfig[status].textLabel}
    </span>
  );
};
