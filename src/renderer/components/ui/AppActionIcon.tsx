import { useSettingsStore } from '../../store/useSettingsStore';
import { ActionIcon, type ActionIconProps } from './ActionIcon';

type AppActionIconProps = Omit<ActionIconProps, 'reducedMotion'>;

export function AppActionIcon(props: AppActionIconProps) {
  const animationsEnabled = useSettingsStore((state) => state.animationsEnabled);

  return <ActionIcon {...props} reducedMotion={animationsEnabled ? 'never' : 'always'} />;
}
