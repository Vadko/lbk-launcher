import NumberFlow, { type NumberFlowProps } from '@number-flow/react';
import React from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';

type AppNumberFlowProps = Omit<NumberFlowProps, 'animated' | 'locales'>;

export const AppNumberFlow: React.FC<AppNumberFlowProps> = (props) => {
  const animationsEnabled = useSettingsStore((state) => state.animationsEnabled);

  return <NumberFlow locales="uk-UA" animated={animationsEnabled} {...props} />;
};
