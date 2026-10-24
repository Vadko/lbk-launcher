import React from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { ActionIcon, type ActionIconProps } from './ActionIcon';

type AppActionIconProps = Omit<ActionIconProps, 'reducedMotion'>;

export const AppActionIcon: React.FC<AppActionIconProps> = (props) => {
  const animationsEnabled = useSettingsStore((state) => state.animationsEnabled);

  return <ActionIcon {...props} reducedMotion={animationsEnabled ? 'never' : 'always'} />;
};
