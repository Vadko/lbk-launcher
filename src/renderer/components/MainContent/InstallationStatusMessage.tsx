import { AlertTriangle } from 'lucide-react';
import React from 'react';
import type { InstallationStatusTone } from '../../../shared/types';

interface InstallationStatusMessageProps {
  statusMessage: string | null;
  statusTone: InstallationStatusTone | null;
  isUpdateAvailable: boolean;
  isOnline: boolean;
  isInstalling: boolean;
}

// класи пишемо повністю: складені рядки Tailwind не бачить при скануванні
const TONE_STYLES: Record<
  InstallationStatusTone,
  { ring: string; dot: string; text: string }
> = {
  error: { ring: 'bg-red-500/20', dot: 'bg-red-500', text: 'text-red-400' },
  waiting: { ring: 'bg-amber-500/20', dot: 'bg-amber-500', text: 'text-amber-400' },
  retry: { ring: 'bg-yellow-500/20', dot: 'bg-yellow-500', text: 'text-yellow-400' },
};

export const InstallationStatusMessage: React.FC<InstallationStatusMessageProps> = ({
  statusMessage,
  statusTone,
  isUpdateAvailable,
  isOnline,
  isInstalling,
}) => {
  const tone = statusTone ? TONE_STYLES[statusTone] : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {tone ? (
          <div
            className={`w-5 h-5 rounded-full flex items-center justify-center ${tone.ring}`}
          >
            <div className={`w-2 h-2 rounded-full animate-pulse ${tone.dot}`} />
          </div>
        ) : (
          <div className="w-5 h-5 border-2 border-color-accent border-t-transparent rounded-full animate-spin" />
        )}
        <span className={`text-sm font-medium ${tone?.text ?? 'text-white'}`}>
          {statusMessage ||
            (isUpdateAvailable
              ? 'Оновлення українізатора...'
              : 'Встановлення українізатора...')}
        </span>
      </div>
      {!isOnline && isInstalling && (
        <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-xs text-red-400 flex items-center gap-1.5">
            <AlertTriangle size={14} className="shrink-0" />
            Відсутнє підключення до Інтернету. Завантаження призупинено.
          </p>
        </div>
      )}
    </div>
  );
};
