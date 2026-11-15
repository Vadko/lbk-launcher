import NumberFlow, { type NumberFlowProps } from '@number-flow/react';
import { currentLocale } from '@/shared/i18n/locale';
import { useSettingsStore } from '../../store/useSettingsStore';

type AppNumberFlowProps = Omit<NumberFlowProps, 'animated' | 'locales'>;

export function AppNumberFlow(props: AppNumberFlowProps) {
  const animationsEnabled = useSettingsStore((state) => state.animationsEnabled);

  return <NumberFlow locales={currentLocale()} animated={animationsEnabled} {...props} />;
}
