import { useSettingsStore } from '../store/useSettingsStore';

export const scrollBehavior = (): ScrollBehavior =>
  useSettingsStore.getState().animationsEnabled ? 'smooth' : 'instant';
