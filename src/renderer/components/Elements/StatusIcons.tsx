import React from 'react';
import { CheckIcon } from '@/renderer/components/Icons/CheckIcon';
import { DownloadIcon } from '@/renderer/components/Icons/DownloadIcon';
import { RefreshIcon } from '@/renderer/components/Icons/RefreshIcon';
import { AiIcon } from '../Icons/AiIcon';
import { PencilIcon } from '../Icons/PencilIcon';

interface StatusIconsProps {
  hasUpdate?: boolean;
  isGameDetected?: boolean;
  isInstalled?: boolean;
  aiType?: string | null;
  floatPosition?: 'default' | 'compact' | null;
  isTranslationAvailable?: boolean;
}

export const StatusIcons: React.FC<StatusIconsProps> = ({
  hasUpdate = false,
  isGameDetected = false,
  isInstalled = false,
  aiType = null,
  floatPosition = null,
  isTranslationAvailable = true,
}) => {
  let statusIcon = null;
  let aiIcon = null;

  if (hasUpdate) {
    statusIcon = (
      <RefreshIcon
        size={floatPosition === 'default' ? 20 : 18}
        className={`${floatPosition ? 'text-text-dark' : 'text-color-accent'}`}
        title="Є оновлення перекладу"
      />
    );
  } else if (isInstalled) {
    statusIcon = (
      <CheckIcon
        size={floatPosition === 'default' ? 20 : 18}
        className={`${floatPosition ? 'text-text-dark' : 'text-color-main'}`}
        title="Переклад актуальний"
      />
    );
  } else if (isGameDetected && isTranslationAvailable) {
    statusIcon = (
      <DownloadIcon
        size={floatPosition === 'default' ? 20 : 18}
        className={`${floatPosition ? 'text-text-dark' : ''}`}
        title="Переклад доступний для встановлення"
      />
    );
  }

  if (aiType === 'edited') {
    aiIcon = (
      <PencilIcon
        size={floatPosition === 'default' ? 20 : 18}
        className={`${floatPosition ? 'text-text-dark' : 'text-color-main'}`}
        title="ШІ + редактура людиною"
      />
    );
  } else if (aiType === 'non-edited') {
    aiIcon = (
      <AiIcon
        size={floatPosition === 'default' ? 20 : 18}
        className={`${floatPosition ? 'text-text-dark' : 'text-color-main'}`}
        title="Переклад ШІ"
      />
    );
  }

  // If no icons to show, return null
  if (!statusIcon && !aiIcon) {
    return null;
  }

  // Show both icons if available, or just one
  return (
    <div
      className={`flex gap-2 ${floatPosition ? 'absolute bg-white/80 rounded-full text-text-dark p-[6px] ring-[6px] ring-[rgba(255,255,255,0.15)]' : ''} ${floatPosition === 'default' ? 'top-5 right-5' : floatPosition === 'compact' ? 'top-3 right-3' : ''}`}
    >
      {statusIcon}
      {aiIcon}
    </div>
  );
};
