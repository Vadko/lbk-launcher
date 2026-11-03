import { Send } from 'lucide';
import { AlertTriangleIcon, FileEditIcon } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { usePrefetchCaptcha } from '@/renderer/hooks/usePrefetchCaptcha';
import { t } from '@/shared/i18n/i18n';
import type { FeedbackType } from '@/shared/types';
import { trackEvent } from '../../utils/analytics';
import { AppActionIcon } from '../ui/AppActionIcon';
import { AppNumberFlow } from '../ui/AppNumberFlow';
import { Checkbox } from '../ui/Checkbox';
import { FeedbackScreenshots, type ScreenshotFile } from './Feedback/FeedbackScreenshots';
import { FeedbackSent } from './Feedback/FeedbackSent';
import { useFeedbackSubmit } from './Feedback/useFeedbackSubmit';
import { Modal } from './Modal';

const MAX_MESSAGE_LENGTH = 1000;

const FEEDBACK_TYPES: {
  value: FeedbackType;
  icon: React.ReactNode;
}[] = [
  {
    value: 'feedback',
    icon: <FileEditIcon size={18} />,
  },
  {
    value: 'error',
    icon: <AlertTriangleIcon size={18} />,
  },
];

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameId: string;
  gameName: string;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  gameId,
  gameName,
}) => {
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('feedback');
  const [message, setMessage] = useState('');
  const [screenshots, setScreenshots] = useState<ScreenshotFile[]>([]);
  const [allowPublish, setAllowPublish] = useState(false);
  const submission = useFeedbackSubmit(gameName);
  usePrefetchCaptcha('review', isOpen && allowPublish);

  const gameRef = useRef({ gameId, gameName });

  useEffect(() => {
    gameRef.current = { gameId, gameName };
  }, [gameId, gameName]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    trackEvent('Feedback Modal Open', {
      'Game Id': gameRef.current.gameId,
      'Game Name': gameRef.current.gameName,
    });
  }, [isOpen]);

  const handleSubmit = () => {
    const trimmedMessage = message.trim();
    // aria-busy instead of disabled: a natively disabled button drops out of the gamepad focus ring
    if (!trimmedMessage || submission.isPending) {
      return;
    }
    void submission.submit({
      gameId,
      type: feedbackType,
      message: trimmedMessage,
      screenshots,
      allowPublish,
    });
  };

  if (submission.sent) {
    return (
      <FeedbackSent
        isOpen={isOpen}
        onClose={onClose}
        type={submission.sent.type}
        allowPublish={submission.sent.allowPublish}
        outcome={submission.sent.outcome}
      />
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('feedbackModal.title')}>
      <div className="flex flex-col gap-5">
        {/* Error type selector */}
        <div>
          <p className="text-sm font-medium text-text-muted mb-3">
            {t('feedbackModal.typeLabel')}
          </p>
          <div className="flex gap-3">
            {FEEDBACK_TYPES.map((type) => (
              <button
                key={type.value}
                onClick={() => setFeedbackType(type.value)}
                data-gamepad-modal-item
                className={`flex items-center gap-3 px-5 py-2.5 rounded-lg border transition-all ${
                  feedbackType === type.value
                    ? 'border-color-main bg-color-main/10 text-text-main'
                    : 'border-border bg-glass text-text-muted hover:border-border-hover'
                }`}
              >
                {type.icon}
                <span className="text-sm leading-tight text-left">
                  {t(`feedbackModal.type.${type.value}`)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <p className="text-sm font-medium text-text-muted mb-3">
            {t('feedbackModal.descriptionLabel')}
          </p>
          <textarea
            value={message}
            onChange={(e) => {
              if (e.target.value.length <= MAX_MESSAGE_LENGTH) {
                setMessage(e.target.value);
              }
            }}
            placeholder={t('feedbackModal.placeholder', { context: feedbackType })}
            // maxLength={MAX_MESSAGE_LENGTH}
            rows={5}
            data-gamepad-modal-item
            className="w-full px-4 py-3 bg-glass border border-border rounded-lg text-text-main placeholder:text-text-muted outline-hidden transition-all duration-300 backdrop-blur-lg resize-none glass-input"
          />
          <div className="flex justify-end mt-1">
            <span
              className={`text-xs ${message.length >= MAX_MESSAGE_LENGTH ? 'text-red-400' : 'text-text-muted'}`}
            >
              <AppNumberFlow
                value={message.length}
                format={{ useGrouping: false }}
                suffix={`/${MAX_MESSAGE_LENGTH}`}
              />
            </span>
          </div>
        </div>

        <FeedbackScreenshots screenshots={screenshots} onChange={setScreenshots} />

        <div className="flex items-center gap-3">
          <Checkbox
            id="allow-publish-feedback"
            checked={allowPublish}
            onCheckedChange={setAllowPublish}
          />
          <label
            htmlFor="allow-publish-feedback"
            className="text-sm text-text-muted cursor-pointer"
          >
            {t('feedbackModal.allowPublish', { context: feedbackType })}
          </label>
        </div>

        {/* Error */}
        {submission.error && (
          <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {submission.error}
          </div>
        )}

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={!message.trim()}
          aria-busy={submission.isPending}
          data-gamepad-confirm
          data-gamepad-modal-item
          className={`w-full py-3 rounded-xl font-bold text-base transition-opacity flex items-center justify-center gap-2 text-text-dark aria-busy:opacity-60 aria-busy:cursor-wait ${
            message.trim()
              ? 'bg-color-main hover:opacity-90'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          <AppActionIcon phase={submission.phase} icon={Send} size={18} inheritColor />
          {t('feedbackModal.submit')}
        </button>
      </div>
    </Modal>
  );
};
