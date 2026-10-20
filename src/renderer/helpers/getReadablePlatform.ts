import { Constants } from '@/lib/database.types';
import { t } from '@/shared/i18n/i18n';

export const getReadablePlatform = (platform: string): string => {
  const known = Constants.public.Enums.install_source.find(
    (candidate) => candidate === platform
  );
  return known ? t(`platformName.${known}`) : platform;
};
