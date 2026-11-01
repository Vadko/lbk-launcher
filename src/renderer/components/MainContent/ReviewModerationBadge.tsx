import { AnimatePresence, motion } from 'framer-motion';
import { Clock } from 'lucide';
import React, { useEffect, useState } from 'react';
import { t } from '@/shared/i18n/i18n';
import type { ActionPhase } from '../../hooks/useActionPhase';
import { AppActionIcon } from '../ui/AppActionIcon';
import { PILL, TONE } from './reviewPill';

type BadgeView = 'checking' | 'confirmed' | 'moderation' | 'failed' | 'hidden';

type SettledView = Exclude<BadgeView, 'checking' | 'hidden'>;

const BADGE: Record<
  Exclude<BadgeView, 'hidden'>,
  { phase: ActionPhase; tone: string }
> = {
  checking: { phase: 'pending', tone: TONE.neutral },
  confirmed: { phase: 'done', tone: TONE.main },
  moderation: { phase: 'idle', tone: TONE.mixed },
  failed: { phase: 'error', tone: TONE.error },
};

const CONFIRMED_MS = 1000;

interface ReviewModerationBadgeProps {
  isChecking: boolean;
  settled: SettledView;
  // The check ended in a refused edit, so it leaves without confirming; later changes ignore it
  isRolledBack: boolean;
  hint: string;
}

export const ReviewModerationBadge: React.FC<ReviewModerationBadgeProps> = ({
  isChecking,
  settled,
  isRolledBack,
  hint,
}) => {
  // Only a check that just ended confirms; a confirmed entry otherwise shows no badge
  const [flash, setFlash] = useState(false);
  const [wasChecking, setWasChecking] = useState(isChecking);
  if (wasChecking !== isChecking) {
    setWasChecking(isChecking);
    setFlash(!isChecking && settled === 'confirmed' && !isRolledBack);
  }

  useEffect(() => {
    if (!flash) {
      return;
    }
    const id = setTimeout(() => setFlash(false), CONFIRMED_MS);
    return () => clearTimeout(id);
  }, [flash]);

  const view: BadgeView = isChecking
    ? 'checking'
    : settled !== 'confirmed'
      ? settled
      : flash
        ? 'confirmed'
        : 'hidden';

  return (
    <AnimatePresence initial={false}>
      {view !== 'hidden' && (
        <motion.span
          key="moderation"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          title={view === 'moderation' || view === 'failed' ? hint : undefined}
          className={`${PILL} ${BADGE[view].tone}`}
        >
          <AppActionIcon phase={BADGE[view].phase} icon={Clock} size={12} inheritColor />
          {t(`gameReviews.badge.${view}`)}
        </motion.span>
      )}
    </AnimatePresence>
  );
};
