import { motion } from 'framer-motion';
import { AlertTriangle, Ban, CheckCircle, ImageIcon, Wrench, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { trackEvent } from '../../utils/analytics';
import { Modal } from './Modal';

const MAX_MESSAGE_LENGTH = 1000;
const MAX_SCREENSHOTS = 5;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

type ErrorType = 'missing_translation' | 'translation_error' | 'technical';

const ERROR_TYPES: {
  value: ErrorType;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
}[] = [
  {
    value: 'missing_translation',
    label: 'Відсутній',
    sublabel: 'переклад',
    icon: <Ban size={18} />,
  },
  {
    value: 'translation_error',
    label: 'Помилка',
    sublabel: 'перекладу',
    icon: <AlertTriangle size={18} />,
  },
  {
    value: 'technical',
    label: 'Технічна',
    sublabel: 'помилка',
    icon: <Wrench size={18} />,
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
  const [errorType, setErrorType] = useState<ErrorType>('missing_translation');
  const [message, setMessage] = useState('');
  const [screenshots, setScreenshots] = useState<ScreenshotFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setErrorType('missing_translation');
      setMessage('');
      setScreenshots([]);
      setIsSubmitting(false);
      setIsSubmitted(false);
      setError(null);
      setIsDragOver(false);
      trackEvent('Feedback Modal Open', { 'Game Id': gameId, 'Game Name': gameName });
    }
  }, [isOpen, gameId, gameName]);

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
        if (!ALLOWED_TYPES.includes(file.type)) continue;
        if (screenshots.length + newFiles.length >= MAX_SCREENSHOTS) break;

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
    if (!trimmedMessage || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      let uploadedPaths: string[] | undefined;

      // Upload screenshots if any
      if (screenshots.length > 0) {
        const urlsResult = await window.electronAPI.getFeedbackUploadUrls(
          screenshots.map((s) => s.name)
        );

        if (!urlsResult.success || !urlsResult.uploadUrls) {
          setError('Не вдалося завантажити скріншоти');
          setIsSubmitting(false);
          return;
        }

        uploadedPaths = [];
        for (let i = 0; i < urlsResult.uploadUrls.length; i++) {
          const { signedUrl, path } = urlsResult.uploadUrls[i];
          const screenshot = screenshots[i];

          // Upload directly from renderer via fetch
          const response = await fetch(signedUrl, {
            method: 'PUT',
            headers: { 'Content-Type': screenshot.type },
            body: screenshot.file,
          });

          if (!response.ok) {
            setError(`Помилка завантаження скріншоту: ${screenshot.name}`);
            setIsSubmitting(false);
            return;
          }

          uploadedPaths.push(path);
        }
      }

      const result = await window.electronAPI.submitFeedback(
        gameId,
        errorType,
        trimmedMessage,
        uploadedPaths
      );

      if (result.success) {
        setIsSubmitted(true);
        trackEvent('Feedback Submitted', {
          'Game Id': gameId,
          'Game Name': gameName,
          'Error Type': errorType,
          'Message Length': trimmedMessage.length,
          Screenshots: screenshots.length,
        });
      } else if (result.error === 'rate_limit') {
        setError('Зачекайте кілька хвилин перед наступним звітом');
        trackEvent('Feedback Rate Limited', { 'Game Id': gameId });
      } else {
        setError(result.error || 'Не вдалося надіслати звіт');
        trackEvent('Feedback Error', { 'Game Id': gameId, Error: result.error });
      }
    } catch {
      setError('Помилка мережі. Спробуйте пізніше');
    } finally {
      setIsSubmitting(false);
    }
  }, [gameId, gameName, errorType, message, screenshots, isSubmitting]);

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
            <CheckCircle size={56} className="text-green-400" />
          </motion.div>
          <p className="text-lg font-semibold text-text-main">Дякуємо за звіт!</p>
          <p className="text-sm text-text-muted">Ваш звіт було надіслано автору перекладу</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Повідомити про помилку">
      <div className="flex flex-col gap-5">
        {/* Error type selector */}
        <div>
          <p className="text-sm font-medium text-text-muted mb-3">Тип помилки</p>
          <div className="flex gap-3">
            {ERROR_TYPES.map((type) => (
              <button
                key={type.value}
                onClick={() => setErrorType(type.value)}
                data-gamepad-modal-item
                className={`flex items-center gap-3 px-5 py-2.5 rounded-lg border transition-all ${
                  errorType === type.value
                    ? 'border-color-main bg-color-main/10 text-text-main'
                    : 'border-border bg-glass text-text-muted hover:border-border-hover'
                }`}
              >
                {type.icon}
                <span className="text-sm leading-tight text-left">
                  {type.label}
                  <br />
                  {type.sublabel}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <p className="text-sm font-medium text-text-muted mb-3">Опис</p>
          <textarea
            value={message}
            onChange={(e) => {
              if (e.target.value.length <= MAX_MESSAGE_LENGTH) {
                setMessage(e.target.value);
              }
            }}
            placeholder="Опишіть де саме помилка, яка мова в грі встановлена ..."
            rows={5}
            data-gamepad-modal-item
            className="w-full px-4 py-3 bg-glass border border-border rounded-lg text-text-main placeholder:text-text-muted outline-none transition-all duration-300 backdrop-blur-lg resize-none glass-input"
          />
          <div className="flex justify-end mt-1">
            <span
              className={`text-xs ${message.length >= MAX_MESSAGE_LENGTH ? 'text-red-400' : 'text-text-muted'}`}
            >
              {message.length}/{MAX_MESSAGE_LENGTH}
            </span>
          </div>
        </div>

        {/* Screenshots dropzone */}
        <div>
          <p className="text-sm font-medium text-text-muted mb-3">
            Скріншоти (Необов'язково)
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
                    <X size={12} className="text-white" />
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
                <span className="font-semibold text-color-main">Оберіть файл</span>
                {' або перетягніть сюди'}
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
              if (e.target.files) addFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={!message.trim() || isSubmitting}
          data-gamepad-confirm
          data-gamepad-modal-item
          className={`w-full py-3 rounded-xl font-bold text-base transition-opacity flex items-center justify-center gap-2 ${
            !message.trim() || isSubmitting
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-color-main text-bg-dark hover:opacity-90'
          }`}
        >
          {isSubmitting ? (
            <>
              <div className="w-5 h-5 border-2 border-bg-dark border-t-transparent rounded-full animate-spin" />
              Надсилання...
            </>
          ) : (
            'Надіслати звіт'
          )}
        </button>
      </div>
    </Modal>
  );
};
