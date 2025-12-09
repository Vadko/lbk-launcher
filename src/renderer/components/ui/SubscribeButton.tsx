import React from 'react';
import { Bell, BellOff } from 'lucide-react';
import { Button } from './Button';
import { useSubscriptionsStore } from '../../store/useSubscriptionsStore';

interface SubscribeButtonProps {
  gameId: string;
  gameName: string;
  gameStatus: string;
  variant?: 'primary' | 'secondary' | 'glass' | 'amber';
  className?: string;
}

export const SubscribeButton: React.FC<SubscribeButtonProps> = ({
  gameId,
  gameName,
  gameStatus,
  variant = 'secondary',
  className = '',
}) => {
  const { isSubscribed, subscribe, unsubscribe } = useSubscriptionsStore();
  const subscribed = isSubscribed(gameId);

  const handleToggle = () => {
    if (subscribed) {
      unsubscribe(gameId);
    } else {
      subscribe(gameId, gameStatus);
    }
  };

  return (
    <Button
      variant={subscribed ? 'amber' : variant}
      onClick={handleToggle}
      className={`flex items-center gap-2 ${className}`}
      title={
        subscribed
          ? `Ви отримуєте сповіщення про "${gameName}"`
          : `Отримувати сповіщення про "${gameName}"`
      }
    >
      {subscribed ? (
        <>
          <BellOff className="w-4 h-4" />
          <span>Вимкнути сповіщення</span>
        </>
      ) : (
        <>
          <Bell className="w-4 h-4" />
          <span>Отримувати сповіщення</span>
        </>
      )}
    </Button>
  );
};