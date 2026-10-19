import { Bell, BellOff } from 'lucide';
import React from 'react';
import { t } from '@/shared/i18n/i18n';
import { useSubscriptionsStore } from '../../store/useSubscriptionsStore';
import { AppActionIcon } from './AppActionIcon';
import { Button } from './Button';

interface TeamSubscribeButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  teamName: string;
  variant?: 'primary' | 'secondary' | 'glass' | 'amber';
  className?: string;
  showTeamName?: boolean;
  multipleAuthors?: boolean;
}

export const TeamSubscribeButton: React.FC<TeamSubscribeButtonProps> = ({
  teamName,
  variant = 'glass',
  className = '',
  showTeamName = false,
  multipleAuthors,
  ...rest
}) => {
  const { isSubscribedToTeam, subscribeToTeam, unsubscribeFromTeam } =
    useSubscriptionsStore();
  const subscribed = isSubscribedToTeam(teamName);
  const isMultiple = multipleAuthors ?? teamName.includes(',');
  const labelContext = showTeamName ? 'team' : isMultiple ? 'multiple' : 'single';

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (subscribed) {
      unsubscribeFromTeam(teamName);
    } else {
      subscribeToTeam(teamName);
    }
  };

  return (
    <Button
      variant={subscribed ? 'amber' : variant}
      onClick={handleToggle}
      className={`flex items-center gap-2 ${className}`}
      title={
        subscribed
          ? t('teamSubscribe.subscribedTitle', { team: teamName })
          : t('teamSubscribe.followTitle', {
              context: isMultiple ? 'multiple' : 'single',
              team: teamName,
            })
      }
      {...rest}
    >
      <AppActionIcon phase="idle" icon={subscribed ? BellOff : Bell} size={16} />
      <span>
        {subscribed
          ? t('teamSubscribe.unfollow', { context: labelContext, team: teamName })
          : t('teamSubscribe.follow', { context: labelContext, team: teamName })}
      </span>
    </Button>
  );
};
