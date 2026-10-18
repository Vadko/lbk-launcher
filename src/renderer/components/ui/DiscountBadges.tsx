import React from 'react';
import { useSteamDiscount } from '@/renderer/hooks/useDiscount';
import { openSteamPage } from '@/renderer/utils/openWithFallback';
import type { Game } from '../../types/game';
import {
  SteamIcon,
  // EAIcon,
  // EpicIcon,
  // GOGIcon,
  // UbisoftIcon,
  // XboxIcon,
} from '../Icons/BrandIcons';
import { Button } from './Button';

interface DiscountBadgeProps {
  icon: React.ReactNode;
  percent: number;
  onClick: () => void;
  title: string;
}

const DiscountBadge: React.FC<DiscountBadgeProps> = ({
  icon,
  percent,
  title,
  onClick,
}) => {
  if (percent <= 0) {
    return null;
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

export const DiscountBadges: React.FC<{ game: Game }> = ({ game }) => {
  const steamPercent = useSteamDiscount();
  const steamAppId = game.steam_app_id;

  return (
    <>
      {steamPercent !== null && steamAppId !== null && (
        <DiscountBadge
          percent={steamPercent}
          title="Відкрити в Steam"
          icon={<SteamIcon size={22} />}
          onClick={() => openSteamPage(steamAppId)}
        />
      )}
    </>
  );
};
