import { Send } from 'lucide';
import React, { useEffect, useRef, useState } from 'react';
import { useActionPhase } from '@/renderer/hooks/useActionPhase';
import { trackEvent } from '../../utils/analytics';
import { AppActionIcon } from '../ui/AppActionIcon';
import { AppNumberFlow } from '../ui/AppNumberFlow';
import { Modal } from './Modal';

interface SendLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  crashReason?: string;
}

export const SendLogsModal: React.FC<SendLogsModalProps> = ({
  isOpen,
  onClose,
  crashReason,
}) => {
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { phase, isPending, isBusy, run } = useActionPhase();
  const closeWhenSettledRef = useRef(false);

  useEffect(() => {
    if (closeWhenSettledRef.current && !isBusy) {
      closeWhenSettledRef.current = false;
      onClose();
    }
  }, [isBusy, onClose]);

  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setError(null);
      setMessage('');
    }
  }

  const handleSubmit = async () => {
    if (isBusy) {
      return;
    }
    setError(null);
    closeWhenSettledRef.current = false;

    try {
      const result = await run(
        () => window.electronAPI.submitLogs(message.trim(), crashReason),
        { isSuccess: (r) => r.success }
      );

      if (result.success) {
        trackEvent('Tech Log Sent', {
          has_comment: !!message.trim(),
        });
        closeWhenSettledRef.current = true;
      } else if (result.error === 'rate_limit') {
        setError('Зачекайте кілька хвилин перед наступною відправкою');
        trackEvent('Tech Log Rate Limited');
      } else {
        setError(result.error || 'Не вдалося надіслати логи');
        trackEvent('Tech Log Error', { Error: result.error });
      }
    } catch (err) {
      console.error('Failed to send logs:', err);
      setError('Помилка мережі. Спробуйте пізніше');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={crashReason ? 'Звіт про помилку' : 'Відправити логи'}
      classNames="!max-w-[520px]"
      footer={
        <div className="grid gap-4">
          <button
            onClick={handleSubmit}
            data-gamepad-confirm
            data-gamepad-modal-item
            aria-busy={isPending}
            className="w-full py-3 rounded-xl font-bold text-base transition-opacity flex items-center justify-center gap-2 text-text-dark bg-color-main hover:opacity-90 aria-busy:opacity-60 aria-busy:cursor-wait"
          >
            <AppActionIcon
              phase={phase}
              icon={Send}
              size={18}
              doneClassName="text-text-dark"
              pendingClassName="text-text-dark"
              errorClassName="text-text-dark"
            />
            Надіслати логи
          </button>
          <p className="text-xs text-text-muted">
            Надіславши логи, ви погоджуєтеся на обробку ваших персональних даних.
          </p>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Crash reason */}
        {crashReason && (
          <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-xs font-medium text-red-400 mb-1">Причина помилки:</p>
            <p className="text-xs text-red-300 font-mono break-all">{crashReason}</p>
          </div>
        )}

        {/* Textarea */}
        <div>
          <label
            htmlFor="log-message"
            className="block text-sm font-medium text-text-muted mb-3"
          >
            Опис (необов'язково)
          </label>
          <textarea
            id="log-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Опишіть що сталося, щоб ми могли швидше розібратися..."
            rows={4}
            maxLength={500}
            disabled={isPending}
            data-gamepad-modal-item
            className="w-full p-4 rounded-xl bg-glass border border-border text-text-main placeholder-text-muted resize-none focus:outline-none focus:border-color-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <p className="text-xs text-right text-text-muted mt-2">
            <AppNumberFlow value={message.length} suffix="/500" />
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
};
