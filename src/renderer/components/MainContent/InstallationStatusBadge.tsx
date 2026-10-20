import { CircleCheck, CircleX, Zap } from 'lucide';
import React from 'react';
import { t } from '@/shared/i18n/i18n';
import { AppActionIcon } from '../ui/AppActionIcon';

interface InstallationStatusBadgeProps {
  isUpdateAvailable: boolean;
  installedVersion: string;
  hasInstallError?: boolean;
  newVersion?: string | null;
}

const STATUS = {
  error: {
    icon: CircleX,
    className: 'text-red-500 animate-pulse',
  },
  update: {
    icon: Zap,
    className: 'text-color-accent animate-pulse',
  },
  installed: {
    icon: CircleCheck,
    className: 'text-color-main',
  },
};

export const InstallationStatusBadge: React.FC<InstallationStatusBadgeProps> = ({
  isUpdateAvailable,
  installedVersion,
  hasInstallError,
  newVersion,
}) => {
  const kind = hasInstallError ? 'error' : isUpdateAvailable ? 'update' : 'installed';
  const status = STATUS[kind];

  return (
    <div className="flex items-center gap-1.5">
      <AppActionIcon
        phase="idle"
        icon={status.icon}
        size={16}
        className={status.className}
      />
      <div className="text-text-main">{t(`installStatus.${kind}`)}</div>
      {!hasInstallError && (
        <div className="text-sm text-text-muted mt-0.5">
          v{installedVersion} {isUpdateAvailable ? `→ v${newVersion}` : ''}
        </div>
      )}
    </div>
  );
};
