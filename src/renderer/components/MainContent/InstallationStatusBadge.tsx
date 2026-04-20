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
  <div className="glass-card">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div
          className={`w-2 h-2 rounded-full ${
            hasInstallError
              ? 'bg-red-500 animate-pulse'
              : isUpdateAvailable
                ? 'bg-color-accent animate-pulse'
                : 'bg-color-main'
          }`}
        />
        <div>
          <div className="text-sm font-medium text-text-main">
            {hasInstallError
              ? '❌ Помилка встановлення'
              : isUpdateAvailable
                ? '⚡ Доступне оновлення'
                : '✓ Українізатор встановлено'}
          </div>
          {!hasInstallError && (
            <div className="text-xs text-text-muted mt-0.5">
              {isUpdateAvailable ? (
                <>
                  Встановлена версія: v{installedVersion} → Нова версія: v{newVersion}
                </>
              ) : (
                <>Версія: v{installedVersion}</>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
);
