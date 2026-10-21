import { DownloadIcon, ThumbsUpIcon } from 'lucide-react';
import React from 'react';
import { t } from '@/shared/i18n/i18n';

interface InfoIconsProps {
  likesCount?: number;
  downloadsCount?: number | null;
  floatPosition?: 'default' | 'compact' | null;
}

export const InfoIcons: React.FC<InfoIconsProps> = ({
  likesCount = 0,
  downloadsCount = 0,
  floatPosition = null,
}) => (
  <div
    className={`flex gap-2 ${floatPosition ? 'absolute rounded-ss-lg bg-glass p-2 pr-4 -bottom-px -right-px backdrop-blur-md backdrop-brightness-50' : ''}`}
  >
    {likesCount > 0 && (
      <div className="flex items-center gap-1">
        <ThumbsUpIcon size={16} />
        <span className="text-sm">{likesCount}</span>
      </div>
    )}
    <div className="flex items-center gap-1">
      <DownloadIcon size={16} />
      <span className="text-sm">
        {downloadsCount && downloadsCount > 20
          ? downloadsCount
          : t('gameInfo.downloadsUnder20')}
      </span>
    </div>
  </div>
);
