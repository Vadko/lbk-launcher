import { Constants } from '@/lib/database.types';
import { t } from '@/shared/i18n/i18n';

// Anything else passes through, as the status labels notices stored before they kept the raw status
export function statusLabel(status: string): string {
  const known = Constants.public.Enums.game_status.find(
    (candidate) => candidate === status
  );
  return known ? t(`gameStatus.${known}`) : status;
}
