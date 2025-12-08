import React from 'react';
import { Bell, BellOff } from 'lucide-react';
import { Button } from './Button';
import { useSubscriptionsStore } from '../../store/useSubscriptionsStore';

interface SubscribeButtonProps {
  gameId: string;
  gameName: string;
  variant?: 'primary' | 'secondary' | 'glass';
  className?: string;
}

export const SubscribeButton: React.FC<SubscribeButtonProps> = ({
  gameId,
  gameName,
  variant = 'secondary',
  className = '',
}) => {
  const { isSubscribed, subscribe, unsubscribe } = useSubscriptionsStore();
  const subscribed = isSubscribed(gameId);

  const handleToggle = () => {
    if (subscribed) {
      unsubscribe(gameId);
    } else {
      subscribe(gameId);
    }
  };

  return (
    <Button
      variant={subscribed ? 'primary' : variant}
      onClick={handleToggle}
      className={`flex items-center gap-2 ${className}`}
      title={
        subscribed
          ? `Ви підписані на оновлення статусу "${gameName}"`
          : `Підписатися на оновлення статусу "${gameName}"`
      }
    >
      {subscribed ? (
        <>
          <BellOff className="w-4 h-4" />
          <span>Відписатися</span>
        </>
      ) : (
        <>
          <Bell className="w-4 h-4" />
          <span>Підписатися</span>
        </>
      )}
    </Button>
  );
};