import { DownloadIcon, ThumbsUpIcon } from 'lucide-react';
import { formatDownloads } from '@/shared/formatters';

interface InfoIconsProps {
  likesCount?: number;
  downloadsCount?: number | null;
  isPlanned?: boolean;
  floatPosition?: 'default' | 'compact' | null;
}

export function InfoIcons({
  likesCount = 0,
  downloadsCount = 0,
  isPlanned = false,
  floatPosition = null,
}: InfoIconsProps) {
  return (
    <div
      className={`flex gap-2 ${floatPosition ? 'absolute rounded-ss-lg bg-glass p-2 pr-4 -bottom-px -right-px backdrop-blur-md backdrop-brightness-50' : ''}`}
    >
      {likesCount > 0 && (
        <div className="flex items-center gap-1">
          <ThumbsUpIcon size={16} />
          <span className="text-sm">{likesCount}</span>
        </div>
      )}
      {!isPlanned && (
        <div className="flex items-center gap-1">
          <DownloadIcon size={16} />
          <span className="text-sm">{formatDownloads(downloadsCount)}</span>
        </div>
      )}
    </div>
  );
}
