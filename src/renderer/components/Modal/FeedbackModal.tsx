import { motion } from 'framer-motion';
import { Send } from 'lucide';
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  FileEditIcon,
  ImageIcon,
  XIcon,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Trans } from 'react-i18next';
import { useActionPhase } from '@/renderer/hooks/useActionPhase';
import { t } from '@/shared/i18n/i18n';
import type { FeedbackType } from '@/shared/types';
import { trackEvent } from '../../utils/analytics';
import { AppActionIcon } from '../ui/AppActionIcon';
import { AppNumberFlow } from '../ui/AppNumberFlow';
import { Checkbox } from '../ui/Checkbox';
import { Modal } from './Modal';

const MAX_MESSAGE_LENGTH = 1000;
const MAX_SCREENSHOTS = 5;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

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

interface ScreenshotFile {
  name: string;
  file: File;
  type: string;
  previewUrl: string;
}

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
  const [allowPublish, setAllowPublish] = useState(true);
  const [screenshots, setScreenshots] = useState<ScreenshotFile[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    phase: submitPhase,
    isPending: isSubmitting,
    run: runSubmit,
  } = useActionPhase();

  const gameRef = useRef({ gameId, gameName });

  useEffect(() => {
    gameRef.current = { gameId, gameName };
  }, [gameId, gameName]);

  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setFeedbackType('feedback');
      setMessage('');
      setAllowPublish(true);
      setScreenshots([]);
      setIsSubmitted(false);
      setError(null);
      setIsDragOver(false);
    }
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    trackEvent('Feedback Modal Open', {
      'Game Id': gameRef.current.gameId,
      'Game Name': gameRef.current.gameName,
    });
  }, [isOpen]);

  // Cleanup preview URLs
  useEffect(() => {
    return () => {
      for (const s of screenshots) {
        URL.revokeObjectURL(s.previewUrl);
      }
    };
  }, [screenshots]);

  // Auto-close after successful submission
  useEffect(() => {
    if (isSubmitted) {
      const timer = setTimeout(onClose, 2000);
      return () => clearTimeout(timer);
    }
  }, [isSubmitted, onClose]);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const newFiles: ScreenshotFile[] = [];
      const fileArray = Array.from(files);

      for (const file of fileArray) {
        if (!ALLOWED_TYPES.includes(file.type)) {
          continue;
        }
        if (screenshots.length + newFiles.length >= MAX_SCREENSHOTS) {
          break;
        }

        newFiles.push({
          name: file.name,
          file,
          type: file.type,
          previewUrl: URL.createObjectURL(file),
        });
      }

      if (newFiles.length > 0) {
        setScreenshots((prev) => [...prev, ...newFiles]);
      }
    },
    [screenshots.length]
  );

  const removeScreenshot = useCallback((index: number) => {
    setScreenshots((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handleSubmit = useCallback(async () => {
    const trimmedMessage = message.trim();
    // aria-busy instead of disabled: a natively disabled button drops out of the gamepad focus ring
    if (!trimmedMessage || isSubmitting) {
      return;
    }

    setError(null);

    try {
      const result = await runSubmit(
        async (): Promise<{ success: boolean; error?: string }> => {
          let uploadedPaths: string[] | undefined;

          if (screenshots.length > 0) {
            const urlsResult = await window.electronAPI.getFeedbackUploadUrls(
              screenshots.map((s) => s.name)
            );

            if (!urlsResult.success || !urlsResult.uploadUrls) {
              return { success: false, error: t('feedbackModal.screenshotsFailed') };
            }

            uploadedPaths = [];
            for (const [i, { signedUrl, path }] of urlsResult.uploadUrls.entries()) {
              const response = await fetch(signedUrl, {
                method: 'PUT',
                headers: { 'Content-Type': screenshots[i].type },
                body: screenshots[i].file,
              });

              if (!response.ok) {
                return {
                  success: false,
                  error: t('feedbackModal.screenshotFailed', {
                    name: screenshots[i].name,
                  }),
                };
              }

              uploadedPaths.push(path);
            }
          }

          return window.electronAPI.submitFeedback(
            gameId,
            feedbackType,
            trimmedMessage,
            uploadedPaths,
            feedbackType === 'feedback' ? allowPublish : undefined
          );
        },
        { isSuccess: (r) => r.success }
      );

      if (result.success) {
        setIsSubmitted(true);
        trackEvent('Feedback Submitted', {
          'Game Id': gameId,
          'Game Name': gameName,
          'Feedback Type': feedbackType,
          ...(feedbackType === 'feedback' && { 'Allow Publish': allowPublish }),
          'Message Length': trimmedMessage.length,
          Screenshots: screenshots.length,
        });
      } else if (result.error === 'rate_limit') {
        setError(t('feedbackModal.rateLimit'));
        trackEvent('Feedback Rate Limited', { 'Game Id': gameId });
      } else {
        setError(result.error || t('feedbackModal.sendFailed'));
        trackEvent('Feedback Error', { 'Game Id': gameId, Error: result.error });
      }
    } catch {
      setError(t('feedbackModal.networkError'));
    }
  }, [
    gameId,
    gameName,
    feedbackType,
    message,
    allowPublish,
    screenshots,
    isSubmitting,
    runSubmit,
  ]);

  // Success state
  if (isSubmitted) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} showCloseButton={false}>
        <div className="flex flex-col items-center gap-4 py-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <CheckCircleIcon size={56} className="text-green-400" />
          </motion.div>
          <p className="text-lg font-semibold text-text-main">
            {t('feedbackModal.thanks')}
          </p>
          <p className="text-sm text-text-muted">{t('feedbackModal.sent')}</p>
        </div>
      </Modal>
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

        {/* Screenshots dropzone */}
        <div>
          <p className="text-sm font-medium text-text-muted mb-3">
            {t('feedbackModal.screenshotsLabel')}
          </p>

          {/* Preview thumbnails */}
          {screenshots.length > 0 && (
            <div className="flex gap-2 mb-3 flex-wrap">
              {screenshots.map((s, i) => (
                <div key={s.previewUrl} className="relative group">
                  <img
                    src={s.previewUrl}
                    alt={s.name}
                    className="w-16 h-16 object-cover rounded-lg border border-border"
                  />
                  <button
                    onClick={() => removeScreenshot(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <XIcon size={12} className="text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {screenshots.length < MAX_SCREENSHOTS && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-lg border border-dashed cursor-pointer transition-all ${
                isDragOver
                  ? 'border-color-main bg-color-main/5'
                  : 'border-border bg-glass hover:border-border-hover'
              }`}
            >
              <ImageIcon size={24} className="text-text-muted" />
              <p className="text-sm text-text-muted">
                <Trans
                  i18nKey="feedbackModal.dropzone"
                  components={{ hl: <span className="font-semibold text-color-main" /> }}
                />
              </p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                addFiles(e.target.files);
              }
              e.target.value = '';
            }}
          />
        </div>

        {feedbackType === 'feedback' && (
          <div className="flex items-center gap-3">
            <Checkbox
              id="allow-publish-feedback"
              checked={allowPublish}
              onCheckedChange={setAllowPublish}
              gamepadModalItem
            />
            <label
              htmlFor="allow-publish-feedback"
              className="text-sm text-text-muted cursor-pointer"
            >
              {t('feedbackModal.allowPublish')}
            </label>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={!message.trim()}
          aria-busy={isSubmitting}
          data-gamepad-confirm
          data-gamepad-modal-item
          className={`w-full py-3 rounded-xl font-bold text-base transition-opacity flex items-center justify-center gap-2 text-text-dark aria-busy:opacity-60 aria-busy:cursor-wait ${
            message.trim()
              ? 'bg-color-main hover:opacity-90'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          <AppActionIcon phase={submitPhase} icon={Send} size={18} inheritColor />
          {t('feedbackModal.submit')}
        </button>
      </div>
    </Modal>
  );
};
