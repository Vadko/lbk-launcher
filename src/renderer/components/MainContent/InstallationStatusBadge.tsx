import React from 'react';

interface InstallationStatusBadgeProps {
  isUpdateAvailable: boolean;
  installedVersion: string;
  hasInstallError?: boolean;
  newVersion?: string | null;
}

export const InstallationStatusBadge: React.FC<InstallationStatusBadgeProps> = ({
  isUpdateAvailable,
  installedVersion,
  hasInstallError,
  newVersion,
}) => (
  <div className="flex items-center gap-1">
    <div
      className={`w-2 h-2 rounded-full ${
        hasInstallError
          ? 'bg-red-500 animate-pulse'
          : isUpdateAvailable
            ? 'bg-color-accent animate-pulse'
            : 'bg-color-main'
      }`}
    />

    <div className="text-text-main">
      {hasInstallError
        ? '❌ Помилка встановлення'
        : isUpdateAvailable
          ? '⚡ Доступне оновлення:'
          : '✓ Українізатор встановлено:'}
    </div>
    {!hasInstallError && (
      <div className="text-sm text-text-muted mt-0.5">
        v{installedVersion} {isUpdateAvailable ? `→ v${newVersion}` : ''}
      </div>
    )}
  </div>
);
