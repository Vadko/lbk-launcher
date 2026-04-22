import React, { useEffect, useState } from 'react';
import { trackEvent } from '../../utils/analytics';
import { Modal } from './Modal';

interface SendLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SendLogsModal: React.FC<SendLogsModalProps> = ({ isOpen, onClose }) => {
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sendStatus, setSendStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSendStatus('idle');
      setError(null);
      setMessage('');
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSendStatus('idle');
    setError(null);

    try {
      const result = await window.electronAPI.submitLogs(message.trim());

      if (result.success) {
        setSendStatus('success');

        // Track event
        trackEvent('Tech Log Sent', {
          has_comment: !!message.trim(),
        });

        // Close modal after success
        setTimeout(() => {
          onClose();
          setMessage('');
          setSendStatus('idle');
          setError(null);
        }, 2000);
      } else if (result.error === 'rate_limit') {
        setError('Зачекайте кілька хвилин перед наступною відправкою');
        setSendStatus('error');
        trackEvent('Tech Log Rate Limited');
      } else {
        setError(result.error || 'Не вдалося надіслати логи');
        setSendStatus('error');
        trackEvent('Tech Log Error', { Error: result.error });
      }
    } catch (err) {
      console.error('Failed to send logs:', err);
      setError('Помилка мережі. Спробуйте пізніше');
      setSendStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Відправити логи"
      classNames="max-w-[520px]"
      footer={
        <div className="grid gap-4">
          <button
            onClick={handleSubmit}
            data-gamepad-confirm
            data-gamepad-modal-item
            disabled={isSubmitting}
            className={`w-full py-3 rounded-xl font-bold text-base transition-opacity flex items-center justify-center gap-2 ${
              isSubmitting
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
              <>Надіслати логи</>
            )}
          </button>
          <p className="text-xs text-text-muted">
            Надіславши логи, ви погоджуєтеся на обробку ваших персональних даних.
          </p>
        </div>
      }
    >
      <div className="space-y-4">
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
            disabled={isSubmitting}
            data-gamepad-modal-item
            className="w-full p-4 rounded-xl bg-glass border border-border text-text-main placeholder-text-muted resize-none focus:outline-none focus:border-color-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <p className="text-xs text-right text-text-muted mt-2">{message.length}/500</p>
        </div>

        {/* Status messages */}
        {sendStatus === 'success' && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/30">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <p className="text-sm text-green-400">Дякуємо! Файл успішно відправлено</p>
          </div>
        )}

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
