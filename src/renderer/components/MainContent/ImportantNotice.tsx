import { Settings } from 'lucide-react';
import React from 'react';
import type { Game } from '@/shared/types';
import { getLanguageHint } from '../../helpers/getLanguageHint';

interface ImportantNoticeProps {
  game: Game;
}

export const ImportantNotice: React.FC<ImportantNoticeProps> = ({ game }) => {
  const langHint = getLanguageHint(game.source_language);
  const hasInstaller =
    !!game.installation_file_windows_path || !!game.installation_file_linux_path;

  // Don't show if no important info
  if (!langHint && !hasInstaller) {
    return null;
  }

  return (
    <>
      {/* Installer Notice */}
      {hasInstaller && (
        <span className="text-text-muted flex items-center gap-1">
          <Settings size={16} className="flex-shrink-0" />
          Інсталятор
        </span>
      )}
      <div className="w-0 h-auto border-l border-border-hover last:hidden first:hidden" />
      {/* Language Notice */}
      {langHint && (
        <div className="flex items-center gap-2">
          <span className="text-text-muted">
            В налаштуваннях гри оберіть{' '}
            <span className="text-color-accent font-medium">{langHint} мову</span>
          </span>
        </div>
      )}
    </>
  );
};
