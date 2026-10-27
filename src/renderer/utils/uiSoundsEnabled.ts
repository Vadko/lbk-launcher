import { useSettingsStore } from '../store/useSettingsStore';

// The sidebar's sound toggle covers the interface sounds, and a window in the background stays silent
export function uiSoundsEnabled(): boolean {
  return document.hasFocus() && useSettingsStore.getState().gamepadSoundsEnabled;
}
