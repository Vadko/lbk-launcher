import NumberFlow, { type NumberFlowProps } from '@number-flow/react';
import { useSettingsStore } from '../../store/useSettingsStore';

type AppNumberFlowProps = Omit<NumberFlowProps, 'animated' | 'locales'>;

export function AppNumberFlow(props: AppNumberFlowProps) {
  const animationsEnabled = useSettingsStore((state) => state.animationsEnabled);

  return <NumberFlow locales="uk-UA" animated={animationsEnabled} {...props} />;
}
