import React from 'react';

interface InstallationStatusBadgeProps {
  isUpdateAvailable: boolean;
  installedVersion: string;
  newVersion?: string | null;
}

export const InstallationStatusBadge: React.FC<InstallationStatusBadgeProps> = ({
  isUpdateAvailable,
  installedVersion,
  newVersion,
}) => (
  <div className="glass-card">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div
          className={`w-2 h-2 rounded-full ${
            isUpdateAvailable ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'
          }`}
        />
        <div>
          <div className="text-sm font-medium text-text-main">
            {isUpdateAvailable ? '⚡ Доступне оновлення' : '✓ Українізатор встановлено'}
          </div>
          <div className="text-xs text-text-muted mt-0.5">
            {isUpdateAvailable ? (
              <>
                Встановлена версія: v{installedVersion} → Нова версія: v{newVersion}
              </>
            ) : (
              <>Версія: v{installedVersion}</>
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
);
