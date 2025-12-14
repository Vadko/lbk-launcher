import React from 'react';

interface InstallationStatusMessageProps {
  statusMessage: string | null;
  isUpdateAvailable: boolean;
  isOnline: boolean;
  isInstalling: boolean;
}

const getStatusIconAndColor = (
  message: string | null
): { icon: React.ReactNode; colorClass: string } => {
  if (message?.startsWith('❌')) {
    return {
      icon: (
        <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        </div>
      ),
      colorClass: 'text-red-400',
    };
  }
  if (message?.includes('Спроба')) {
    return {
      icon: (
        <div className="w-5 h-5 rounded-full bg-yellow-500/20 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
        </div>
      ),
      colorClass: 'text-yellow-400',
    };
  }
  return {
    icon: (
      <div className="w-5 h-5 border-2 border-neon-blue border-t-transparent rounded-full animate-spin" />
    ),
    colorClass: 'text-white',
  };
};

export const InstallationStatusMessage: React.FC<InstallationStatusMessageProps> = ({
  statusMessage,
  isUpdateAvailable,
  isOnline,
  isInstalling,
}) => {
  const { icon, colorClass } = getStatusIconAndColor(statusMessage);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {icon}
        <span className={`text-sm font-medium ${colorClass}`}>
          {statusMessage ||
            (isUpdateAvailable
              ? 'Оновлення українізатора...'
              : 'Встановлення українізатора...')}
        </span>
      </div>
      {!isOnline && isInstalling && (
        <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-xs text-red-400">
            ⚠️ Відсутнє підключення до Інтернету. Завантаження призупинено.
          </p>
        </div>
      )}
    </div>
  );
};
