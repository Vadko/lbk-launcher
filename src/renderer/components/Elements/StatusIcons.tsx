import { BookmarkCheckIcon } from 'lucide-react';
import React from 'react';
import { CheckIcon } from '@/renderer/components/Icons/CheckIcon';
import { DownloadIcon } from '@/renderer/components/Icons/DownloadIcon';
import { RefreshIcon } from '@/renderer/components/Icons/RefreshIcon';
import { t } from '@/shared/i18n/i18n';
import { AiIcon } from '../Icons/AiIcon';
import { PencilIcon } from '../Icons/PencilIcon';

interface StatusIconsProps {
  hasUpdate?: boolean;
  isGameDetected?: boolean;
  isInstalled?: boolean;
  aiType?: string | null;
  floatPosition?: 'default' | 'compact' | null;
  isTranslationAvailable?: boolean;
  isFavorite?: boolean;
}

export const StatusIcons: React.FC<StatusIconsProps> = ({
  hasUpdate = false,
  isGameDetected = false,
  isInstalled = false,
  aiType = null,
  floatPosition = null,
  isTranslationAvailable = true,
  isFavorite = false,
}) => {
  let statusIcon = null;
  let aiIcon = null;
  let favoriteIcon = null;

  if (hasUpdate) {
    statusIcon = (
      <RefreshIcon
        size={floatPosition === 'default' ? 20 : 18}
        className={floatPosition ? 'text-text-dark' : 'text-color-accent'}
        title={t('translationStatusIcons.updateAvailable')}
      />
    );
  } else if (isInstalled) {
    statusIcon = (
      <CheckIcon
        size={floatPosition === 'default' ? 20 : 18}
        className={floatPosition ? 'text-text-dark' : 'text-color-main'}
        title={t('translationStatusIcons.upToDate')}
      />
    );
  } else if (isGameDetected && isTranslationAvailable) {
    statusIcon = (
      <DownloadIcon
        size={floatPosition === 'default' ? 20 : 18}
        className={floatPosition ? 'text-text-dark' : ''}
        title={t('translationStatusIcons.availableToInstall')}
      />
    );
  }

  if (aiType === 'edited') {
    aiIcon = (
      <PencilIcon
        size={floatPosition === 'default' ? 20 : 18}
        className={floatPosition ? 'text-text-dark' : 'text-color-main'}
        title={t('translationStatusIcons.aiEdited')}
      />
    );
  } else if (aiType === 'non-edited') {
    aiIcon = (
      <AiIcon
        size={floatPosition === 'default' ? 20 : 18}
        className={floatPosition ? 'text-text-dark' : 'text-color-main'}
        title={t('translationStatusIcons.aiOnly')}
      />
    );
  }

  if (isFavorite && !floatPosition) {
    favoriteIcon = (
      <div title={t('translationStatusIcons.favorite')}>
        <BookmarkCheckIcon size={18} className="text-color-accent" />
      </div>
    );
  }

  if (!statusIcon && !aiIcon && !favoriteIcon) {
    return null;
  }

  return (
    <div
      className={`flex gap-2 ${floatPosition ? 'absolute bg-white/80 rounded-full text-text-dark p-[6px] ring-[6px] ring-[rgba(255,255,255,0.15)]' : ''} ${floatPosition === 'default' ? 'top-5 right-5' : floatPosition === 'compact' ? 'top-3 right-3' : ''}`}
    >
      {favoriteIcon}
      {statusIcon}
      {aiIcon}
    </div>
  );
};
