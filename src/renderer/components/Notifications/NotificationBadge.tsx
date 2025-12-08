import React from 'react';
import { History } from 'lucide-react';
import { useSubscriptionsStore } from '../../store/useSubscriptionsStore';

interface NotificationBadgeProps {
  onClick: () => void;
  className?: string;
}

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({ onClick, className = '' }) => {
  const unreadCount = useSubscriptionsStore((state) => state.unreadCount);

  return (
    <button
      onClick={onClick}
      className={`relative p-2 rounded-lg bg-glass hover:bg-glass-hover transition-all duration-200 ${className}`}
      title={unreadCount > 0 ? `У вас ${unreadCount} нових записів в історії` : 'Історія оновлень'}
    >
      <History className="w-5 h-5 text-white" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[20px] px-1 h-5 bg-neon-blue text-bg-dark text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
};