import { AnimatePresence, motion } from 'framer-motion';
import { Clock } from 'lucide';
import React, { useEffect, useRef, useState } from 'react';
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

// A fast answer would flash the spinner, so the check holds it at least this long
const MIN_CHECKING_MS = 600;
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
  const [view, setView] = useState<BadgeView>(
    isChecking ? 'checking' : settled === 'confirmed' ? 'hidden' : settled
  );
  const [prev, setPrev] = useState({ isChecking, settled });
  const checkingSinceRef = useRef(0);

  if (prev.isChecking !== isChecking || prev.settled !== settled) {
    setPrev({ isChecking, settled });
    if (isChecking) {
      setView('checking');
    } else if (view !== 'checking') {
      // A failed attempt dropped by a refetch was never confirmed, so it just leaves
      setView(settled === 'confirmed' && prev.settled === 'failed' ? 'hidden' : settled);
    }
  }

  useEffect(() => {
    if (isChecking) {
      checkingSinceRef.current = Date.now();
    }
  }, [isChecking]);

  useEffect(() => {
    if (isChecking || view !== 'checking') {
      return;
    }
    const wait = Math.max(0, MIN_CHECKING_MS - (Date.now() - checkingSinceRef.current));
    const id = setTimeout(
      () => setView(isRolledBack && settled === 'confirmed' ? 'hidden' : settled),
      wait
    );
    return () => clearTimeout(id);
  }, [isChecking, settled, isRolledBack, view]);

  useEffect(() => {
    if (view !== 'confirmed') {
      return;
    }
    const id = setTimeout(() => setView('hidden'), CONFIRMED_MS);
    return () => clearTimeout(id);
  }, [view]);

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
