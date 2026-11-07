import { motion } from 'framer-motion';
import { CheckCircleIcon, ClockIcon, ShieldXIcon } from 'lucide-react';
import React, { useEffect, useEffectEvent } from 'react';
import type { GameReviewOutcome } from '@/shared/game-reviews-types';
import { t } from '@/shared/i18n/i18n';
import type { FeedbackType } from '@/shared/types';
import { Modal } from '../Modal';
import { type FeedbackSentScreen, feedbackSentView } from './feedbackSentView';

const ICONS: Record<FeedbackSentScreen, React.ReactNode> = {
  private: <CheckCircleIcon size={56} className="text-green-400" />,
  published: <CheckCircleIcon size={56} className="text-green-400" />,
  pending: <ClockIcon size={56} className="text-amber-400" />,
  removed: <ShieldXIcon size={56} className="text-red-400" />,
};

interface FeedbackSentProps {
  isOpen: boolean;
  onClose: () => void;
  type: FeedbackType;
  allowPublish: boolean;
  outcome: GameReviewOutcome;
}

export const FeedbackSent: React.FC<FeedbackSentProps> = ({
  isOpen,
  onClose,
  type,
  allowPublish,
  outcome,
}) => {
  const view = feedbackSentView(type, allowPublish, outcome);
  // The parent passes a fresh onClose on every render, which would restart the timer each time
  const close = useEffectEvent(onClose);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const timer = setTimeout(() => close(), view.closeAfterMs);
    return () => clearTimeout(timer);
  }, [isOpen, view.closeAfterMs]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} showCloseButton={false}>
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          {ICONS[view.screen]}
        </motion.div>
        <p className="text-lg font-semibold text-text-main">{t(view.title)}</p>
        <p className="text-sm text-text-muted">{t(view.text)}</p>
      </div>
    </Modal>
  );
};
