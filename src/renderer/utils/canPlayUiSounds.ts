import { useSettingsStore } from '../store/useSettingsStore';

// The sidebar's sound toggle covers the interface sounds, and a window in the background stays silent
export function canPlayUiSounds(): boolean {
  return document.hasFocus() && useSettingsStore.getState().uiSoundsEnabled;
}
