import React from 'react';
import { Pause, Play, X } from 'lucide-react';
import { formatBytes, formatTime } from '../../../shared/formatters';
import type { DownloadProgress } from '../../../shared/types';

interface DownloadProgressCardProps {
  progress: number;
  downloadProgress: DownloadProgress;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}

export const DownloadProgressCard: React.FC<DownloadProgressCardProps> = ({
  progress,
  downloadProgress,
  isPaused,
  onPause,
  onResume,
  onCancel,
}) => (
    <>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-text-main">
          {isPaused ? 'Завантаження призупинено' : 'Завантаження файлів...'}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-neon-blue">{Math.round(progress)}%</span>

          <div className="flex gap-1 ml-2">
            {isPaused ? (
              <button
                onClick={onResume}
                className="p-1.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 transition-colors"
                title="Продовжити"
              >
                <Play size={16} />
              </button>
            ) : (
              <button
                onClick={onPause}
                className="p-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 transition-colors"
                title="Пауза"
              >
                <Pause size={16} />
              </button>
            )}
            <button
              onClick={onCancel}
              className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
              title="Скасувати"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${
            isPaused
              ? 'bg-gradient-to-r from-amber-500 to-amber-600'
              : 'bg-gradient-to-r from-neon-blue to-neon-purple'
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
              <span className="text-neon-blue font-medium">
                {formatBytes(downloadProgress.bytesPerSecond)}/с
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Залишилось часу:</span>
              <span className="text-neon-purple font-medium">
                {formatTime(downloadProgress.timeRemaining)}
              </span>
            </div>
          </>
        )}
      </div>
    </>
  );
