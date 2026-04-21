import React, { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { Modal } from './Modal';

interface SendLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MAX_REPORTS_PER_DAY = 3;
const STORAGE_KEY = 'logs_sent_count';
const STORAGE_DATE_KEY = 'logs_sent_date';

export const SendLogsModal: React.FC<SendLogsModalProps> = ({ isOpen, onClose }) => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [remainingReports, setRemainingReports] = useState(MAX_REPORTS_PER_DAY);

  useEffect(() => {
    if (isOpen) {
      checkRemainingReports();
      setSendStatus('idle');
      setMessage('');
    }
  }, [isOpen]);

  const checkRemainingReports = () => {
    const today = new Date().toDateString();
    const storedDate = window.storeStorage?.getItem(STORAGE_DATE_KEY);
    const storedCount = window.storeStorage?.getItem(STORAGE_KEY);

    if (storedDate === today && storedCount) {
      const count = parseInt(storedCount, 10);
      setRemainingReports(Math.max(0, MAX_REPORTS_PER_DAY - count));
    } else {
      // New day, reset counter
      window.storeStorage?.setItem(STORAGE_DATE_KEY, today);
      window.storeStorage?.setItem(STORAGE_KEY, '0');
      setRemainingReports(MAX_REPORTS_PER_DAY);
    }
  };

  const handleSend = async () => {
    if (remainingReports <= 0) {
      setSendStatus('error');
      return;
    }

    if (!message.trim() || message.trim().length < 10) {
      return;
    }

    setIsSending(true);
    setSendStatus('idle');

    try {
      const result = await window.loggerAPI?.sendLogs?.(message.trim());

      if (result?.success) {
        setSendStatus('success');

        // Update counter
        const today = new Date().toDateString();
        const storedCount = window.storeStorage?.getItem(STORAGE_KEY);
        const newCount = storedCount ? parseInt(storedCount, 10) + 1 : 1;
        window.storeStorage?.setItem(STORAGE_KEY, newCount.toString());
        window.storeStorage?.setItem(STORAGE_DATE_KEY, today);
        setRemainingReports(Math.max(0, MAX_REPORTS_PER_DAY - newCount));

        // Close modal after success
        setTimeout(() => {
          onClose();
          setMessage('');
          setSendStatus('idle');
        }, 2000);
      } else {
        setSendStatus('error');
      }
    } catch (error) {
      console.error('Failed to send logs:', error);
      setSendStatus('error');
    } finally {
      setIsSending(false);
    }
  };

  const canSend = !isSending && remainingReports > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Відправити логи"
      classNames="max-w-[520px]"
      footer={
        <div className="grid gap-4">
          <Button
            onClick={handleSend}
            variant="primary"
            className="flex-1"
            disabled={!canSend}
          >
            {isSending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Відправлення...
              </>
            ) : (
              <>Надіслати логи</>
            )}
          </Button>
          <p className="text-xs text-text-muted">
            Надіславши логи, ви погоджуєтеся на обробку ваших персональних даних.
          </p>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Remaining reports counter */}
        {remainingReports > 0 ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-glass border border-border">
            <div className="w-2 h-2 rounded-full bg-color-main" />
            <p className="text-xs text-text-muted">
              Залишилось відправок сьогодні: {remainingReports} з {MAX_REPORTS_PER_DAY}
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <p className="text-xs text-red-400">
              Ви вичерпали ліміт відправок на сьогодні. Спробуйте завтра.
            </p>
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
            disabled={isSending || remainingReports <= 0}
            data-gamepad-modal-item
            className="w-full p-4 rounded-xl bg-glass border border-border text-text-main placeholder-text-muted resize-none focus:outline-none focus:border-color-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <p className="text-xs text-right text-text-muted mt-2">{message.length}/500</p>
        </div>

        {/* Status messages */}
        {sendStatus === 'success' && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/30">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <p className="text-sm text-green-400">
              Логи успішно відправлено! Дякуємо за звернення.
            </p>
          </div>
        )}

        {sendStatus === 'error' && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <p className="text-sm text-red-400">
              Помилка відправки. Спробуйте пізніше або зверніться до підтримки.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
};
