import { Bell, BellOff } from 'lucide';
import React from 'react';
import { t } from '@/shared/i18n/i18n';
import { useSubscriptionsStore } from '../../store/useSubscriptionsStore';
import { AppActionIcon } from './AppActionIcon';
import { Button } from './Button';

interface SubscribeButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
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
  ...rest
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
          ? t('gameSubscribe.subscribedTitle', { game: gameName })
          : t('gameSubscribe.subscribeTitle', { game: gameName })
      }
      {...rest}
    >
      <AppActionIcon phase="idle" icon={subscribed ? BellOff : Bell} size={16} />
      <span>
        {subscribed ? t('gameSubscribe.unsubscribe') : t('gameSubscribe.subscribe')}
      </span>
    </Button>
  );
};
