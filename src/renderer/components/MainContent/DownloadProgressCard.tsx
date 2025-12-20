import React from 'react';
import { formatBytes, formatTime } from '../../../shared/formatters';
import type { DownloadProgress } from '../../../shared/types';

interface DownloadProgressCardProps {
  progress: number;
  downloadProgress: DownloadProgress;
}

export const DownloadProgressCard: React.FC<DownloadProgressCardProps> = ({
  progress,
  downloadProgress,
}) => {
  return (
    <>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-text-main">Завантаження файлів...</span>
        <span className="text-sm font-bold text-neon-blue">{Math.round(progress)}%</span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-3">
        <div
          className="h-full rounded-full transition-all duration-300 ease-out bg-gradient-to-r from-neon-blue to-neon-purple"
          style={{
            width: `${progress}%`,
            boxShadow: '0 0 10px rgba(0, 242, 255, 0.5)',
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
      </div>
    </>
  );
};
