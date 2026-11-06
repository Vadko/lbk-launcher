import { ImageIcon } from 'lucide-react';
import React from 'react';
import { t } from '@/shared/i18n/i18n';

interface SteamArtworkOptionProps {
  checked: boolean;
  onToggle: (checked: boolean) => void;
}

export const SteamArtworkOption: React.FC<SteamArtworkOptionProps> = ({
  checked,
  onToggle,
}) => (
  <label className="flex items-start gap-4 cursor-pointer group">
    <div className="relative flex items-center justify-center mt-0.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onToggle(e.target.checked)}
        data-gamepad-modal-item
        className="appearance-none w-5 h-5 rounded-md bg-glass border border-border checked:bg-color-main checked:border-color-main transition-colors cursor-pointer focus:ring-2 focus:ring-color-main/50 focus:outline-hidden"
      />
      <svg
        className={`absolute w-3 h-3 text-text-dark pointer-events-none transition-opacity ${
          checked ? 'opacity-100' : 'opacity-0'
        }`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </div>
    <div className="flex-1">
      <div className="flex items-center gap-2">
        <ImageIcon size={18} className="text-color-accent" />
        <span className="font-medium text-text-main group-hover:text-color-accent transition-colors">
          {t('installOptions.steamArtworkTitle')}
        </span>
      </div>
      <p className="text-sm text-text-muted mt-1">
        {t('installOptions.steamArtworkDescription')}
      </p>
    </div>
  </label>
);
