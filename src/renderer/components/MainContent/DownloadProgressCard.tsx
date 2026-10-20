import { Pause, Play } from 'lucide';
import { XIcon } from 'lucide-react';
import React, { useState } from 'react';
import { useModalStore } from '@/renderer/store/useModalStore';
import { formatBytes, formatTime } from '../../../shared/formatters';
import type { DownloadProgress } from '../../../shared/types';
import { AppActionIcon } from '../ui/AppActionIcon';

interface DownloadProgressCardProps {
  progress: number;
  downloadProgress: DownloadProgress;
  isPaused: boolean;
  onPause: () => Promise<void>;
  onResume: () => Promise<void>;
  onCancel: () => Promise<void>;
}

export const DownloadProgressCard: React.FC<DownloadProgressCardProps> = ({
  progress,
  downloadProgress,
  isPaused,
  onPause,
  onResume,
  onCancel,
}) => {
  const showModal = useModalStore((state) => state.showModal);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const handleToggle = async () => {
    if (isToggling) {
      return;
    }
    setIsToggling(true);
    try {
      await (isPaused ? onResume() : onPause());
    } catch (error) {
      console.error('[DownloadProgressCard] pause/resume failed:', error);
      showModal({
        title: 'Помилка',
        message:
          error instanceof Error ? error.message : 'Не вдалося змінити стан завантаження',
        type: 'error',
      });
    } finally {
      setIsToggling(false);
    }
  };

  const handleCancel = async () => {
    if (isCancelling) {
      return;
    }
    setIsCancelling(true);
    try {
      await onCancel();
    } catch (error) {
      console.error('[DownloadProgressCard] cancel failed:', error);
      showModal({
        title: 'Помилка',
        message:
          error instanceof Error ? error.message : 'Не вдалося скасувати завантаження',
        type: 'error',
      });
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-text-main">
          {isPaused ? 'Завантаження призупинено' : 'Завантаження файлів...'}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-color-accent">
            {Math.round(progress)}%
          </span>

          <div className="flex gap-1 ml-2">
            <button
              onClick={handleToggle}
              aria-busy={isToggling}
              className={`inline-flex items-center justify-center p-1.5 rounded-lg transition-colors aria-busy:opacity-60 aria-busy:cursor-wait ${
                isPaused
                  ? 'bg-green-500/20 hover:bg-green-500/30 text-green-400'
                  : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-400'
              }`}
              title={isPaused ? 'Продовжити' : 'Пауза'}
            >
              <AppActionIcon phase="idle" icon={isPaused ? Play : Pause} size={16} />
            </button>
            <button
              onClick={handleCancel}
              aria-busy={isCancelling}
              className="inline-flex items-center justify-center p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors aria-busy:opacity-60 aria-busy:cursor-wait"
              title="Скасувати"
            >
              <XIcon size={16} />
            </button>
          </div>
        </div>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${
            isPaused
              ? 'bg-linear-to-r/srgb from-amber-500 to-amber-600'
              : 'bg-linear-to-r/srgb from-color-accent to-color-main'
          }`}
          style={{
            width: `${progress}%`,
            boxShadow: isPaused
              ? '0 0 10px rgba(245, 158, 11, 0.5)'
              : '0 0 10px rgba(0, 242, 255, 0.5)',
          }}
        />
      </div>
      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-text-muted">Завантажено:</span>
          <span className="text-text-main font-medium">
            {formatBytes(downloadProgress.downloadedBytes)} /{' '}
            {formatBytes(downloadProgress.totalBytes)}
          </span>
        </div>
        {!isPaused && (
          <>
            <div className="flex justify-between">
              <span className="text-text-muted">Швидкість:</span>
              <span className="text-color-accent font-medium">
                {formatBytes(downloadProgress.bytesPerSecond)}/с
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Залишилось часу:</span>
              <span className="text-color-main font-medium">
                {formatTime(downloadProgress.timeRemaining)}
              </span>
            </div>
          </>
        )}
      </div>
    </>
  );
};
