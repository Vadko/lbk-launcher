import React from 'react';

interface StatusBadgeProps {
  status: React.ReactNode;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => (
  <span
    className={
      className + status === 'completed'
        ? 'text-color-main'
        : status === 'in-progress'
          ? 'text-color-accent'
          : 'text-text-main'
    }
  >
    {status === 'completed'
      ? 'Завершено'
      : status === 'in-progress'
        ? 'Ранній доступ'
        : status === 'planned'
          ? 'Заплановано'
          : status}
  </span>
);
