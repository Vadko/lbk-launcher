import React from 'react';
import { useSteamDiscount } from '@/renderer/hooks/useDiscount';
import { openSteamPage } from '@/renderer/utils/openWithFallback';
import { t } from '@/shared/i18n/i18n';
import type { Game } from '../../../shared/types';
import {
  SteamIcon,
  // EAIcon,
  // EpicIcon,
  // GOGIcon,
  // UbisoftIcon,
  // XboxIcon,
} from '../Icons/BrandIcons';
import { Button } from './Button';

type BadgeStyleType = 'button' | 'badge';

interface DiscountBadgeProps {
  icon: React.ReactNode;
  percent: number;
  onClick: () => void;
  title: string;
  type: BadgeStyleType;
}

const DiscountBadge: React.FC<DiscountBadgeProps> = ({
  icon,
  percent,
  title,
  onClick,
  type,
}) => {
  if (percent <= 0) {
    return null;
  }

  if (type === 'badge') {
    return (
      <div className="flex items-center gap-2 bg-white/80 rounded-full leading-none text-text-dark p-[6px] ring-[6px] ring-[rgba(255,255,255,0.15)]">
        {icon}-{percent}%
      </div>
    );
  }

  return (
    <Button
      onClick={onClick}
      variant="secondary"
      data-gamepad-action
      title={title}
      className="!px-3 !bg-white/25 !border-white"
    >
      {icon}
      <span className="font-bold text-base leading-none">-{percent}%</span>
    </Button>
  );
};

export const DiscountBadges: React.FC<{ game: Game; type: BadgeStyleType }> = ({
  game,
  type,
}) => {
  const steamPercent = useSteamDiscount();
  const steamAppId = game.steam_app_id;

  return (
    <>
      {steamPercent !== null && steamAppId !== null && (
        <DiscountBadge
          percent={steamPercent}
          title={t('gameInfo.openInSteam')}
          icon={<SteamIcon size={type === 'button' ? 22 : 20} />}
          onClick={() => openSteamPage(steamAppId)}
          type={type}
        />
      )}
    </>
  );
};
