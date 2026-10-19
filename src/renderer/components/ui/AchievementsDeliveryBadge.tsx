import { CircleCheckIcon, ClockIcon, EyeOffIcon, TriangleAlertIcon } from 'lucide-react';
import React from 'react';
import { t } from '@/shared/i18n/i18n';
import type { AchievementsBadge } from '@/shared/plugin-host-types';
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

const HIDDEN_VIEW: { label: string; tone: BadgeTone } = {
  label: t('achievementsBadge.hidden'),
  tone: 'muted',
};

const BADGE_VIEWS: Record<
  AchievementsBadge['state'],
  { label: string; tone: BadgeTone }
> = {
  millennium: { label: t('achievementsBadge.millennium'), tone: 'success' },
  decky: { label: t('achievementsBadge.decky'), tone: 'success' },
  'after-restart': { label: t('achievementsBadge.afterRestart'), tone: 'neutral' },
  'needs-millennium': { label: t('achievementsBadge.needsMillennium'), tone: 'warning' },
  'needs-decky-plugin': {
    label: t('achievementsBadge.needsDeckyPlugin'),
    tone: 'warning',
  },
  'needs-decky': { label: t('achievementsBadge.needsDecky'), tone: 'warning' },
  unsupported: HIDDEN_VIEW,
  'setting-off': HIDDEN_VIEW,
};

interface AchievementsDeliveryBadgeProps {
  badge: AchievementsBadge;
}

export const AchievementsDeliveryBadge: React.FC<AchievementsDeliveryBadgeProps> = ({
  badge,
}) => {
  const { label, tone } = BADGE_VIEWS[badge.state];
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
