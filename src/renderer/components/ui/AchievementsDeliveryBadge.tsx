import { CircleCheckIcon, ClockIcon, EyeOffIcon, TriangleAlertIcon } from 'lucide-react';
import React from 'react';
import type { AchievementsBadge } from '@/shared/types';
import { achievementsBadgeDetail } from '../../utils/steamPluginHost';

type BadgeTone = 'success' | 'neutral' | 'warning' | 'muted';

const TONE_CLASSES: Record<BadgeTone, string> = {
  success: 'bg-color-main/15 border-color-main/40 text-color-main',
  neutral: 'bg-glass border-border text-text-main',
  warning: 'bg-color-accent/15 border-color-accent/40 text-color-accent',
  muted: 'bg-glass border-border text-text-muted',
};

const TONE_ICONS: Record<BadgeTone, React.ReactNode> = {
  success: <CircleCheckIcon size={12} className="shrink-0" />,
  neutral: <ClockIcon size={12} className="shrink-0" />,
  warning: <TriangleAlertIcon size={12} className="shrink-0" />,
  muted: <EyeOffIcon size={12} className="shrink-0" />,
};

function badgeView(badge: AchievementsBadge): { label: string; tone: BadgeTone } {
  switch (badge.state) {
    case 'millennium':
      return { label: 'Працюватиме через Millennium', tone: 'success' };
    case 'decky':
      return { label: 'Працюватиме через Decky', tone: 'success' };
    case 'after-restart':
      return { label: "З'явиться після перезапуску Steam", tone: 'neutral' };
    case 'needs-millennium':
      return { label: 'Потрібен Millennium', tone: 'warning' };
    case 'needs-decky-plugin':
      return { label: 'Потрібен плагін для Decky', tone: 'warning' };
    case 'needs-decky':
      return { label: 'Потрібен Decky Loader', tone: 'warning' };
    default:
      return { label: 'Не покажуться в Steam', tone: 'muted' };
  }
}

interface AchievementsDeliveryBadgeProps {
  badge: AchievementsBadge;
}

export const AchievementsDeliveryBadge: React.FC<AchievementsDeliveryBadgeProps> = ({
  badge,
}) => {
  const { label, tone } = badgeView(badge);
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium leading-tight ${TONE_CLASSES[tone]}`}
      title={achievementsBadgeDetail(badge) ?? undefined}
    >
      {TONE_ICONS[tone]}
      <span className="min-w-0 wrap-break-word">{label}</span>
    </span>
  );
};
