import { WineIcon } from 'lucide-react';
import { t } from '@/shared/i18n/i18n';

interface WineTargetNoteProps {
  bottle: string;
}

export function WineTargetNote({ bottle }: WineTargetNoteProps) {
  return (
    <div className="bg-glass rounded-xl p-3 border border-border flex items-start gap-2 text-sm">
      <WineIcon size={16} className="text-color-main shrink-0 mt-0.5" />
      <p className="text-text-muted">{t('installOptions.wineTarget', { bottle })}</p>
    </div>
  );
}
