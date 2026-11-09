import { ImageIcon } from 'lucide-react';
import { t } from '@/shared/i18n/i18n';
import { OptionCheckbox } from './OptionCheckbox';

interface SteamArtworkOptionProps {
  checked: boolean;
  onToggle: (checked: boolean) => void;
}

export function SteamArtworkOption({ checked, onToggle }: SteamArtworkOptionProps) {
  return (
    <label className="flex items-start gap-4 cursor-pointer group">
      <OptionCheckbox checked={checked} onChange={onToggle} />
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
}
