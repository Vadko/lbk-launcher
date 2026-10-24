import { SettingsIcon, TerminalSquareIcon } from 'lucide-react';
import React from 'react';
import { Trans } from 'react-i18next';
import { t } from '@/shared/i18n/i18n';
import { isExeInstaller } from '@/shared/installer-kind';
import type { Game } from '@/shared/types';
import { getLanguageHint } from '../../helpers/getLanguageHint';

interface ImportantNoticeProps {
  game: Game;
}

export const ImportantNotice: React.FC<ImportantNoticeProps> = ({ game }) => {
  const langHint = getLanguageHint(game.source_language);
  const hasInstaller =
    !!game.installation_file_windows_path || !!game.installation_file_linux_path;
  // Pre-download guess from the Windows column; the run prompt names the file main picked.
  const isExe = isExeInstaller(game.installation_file_windows_path ?? '');

  // Don't show if no important info
  if (!langHint && !hasInstaller) {
    return null;
  }

  return (
    <>
      {/* Installer Notice */}
      {hasInstaller && (
        <span className="text-text-muted flex items-center gap-1">
          {isExe ? (
            <SettingsIcon size={16} className="shrink-0" />
          ) : (
            <TerminalSquareIcon size={16} className="shrink-0" />
          )}
          {t('gameNotice.kind', { context: isExe ? 'installer' : 'script' })}
        </span>
      )}
      <div className="divider w-0 h-auto border-l border-border-hover last:hidden first:hidden" />
      {/* Language Notice */}
      {langHint && (
        <div className="flex items-center gap-2">
          <span className="text-text-muted">
            <Trans
              i18nKey="gameNotice.language"
              values={{ language: langHint }}
              components={{ accent: <span className="text-color-accent font-medium" /> }}
            />
          </span>
        </div>
      )}
    </>
  );
};
