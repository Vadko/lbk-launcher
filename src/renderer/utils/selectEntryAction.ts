import { useGamepadModeStore } from '../store/useGamepadModeStore';
import { selectGamepadTarget } from './selectGamepadTarget';

export function selectEntryAction(entry: HTMLElement): void {
  useGamepadModeStore.getState().setNavigationArea('main-content');
  const action = entry.querySelector<HTMLElement>('[data-gamepad-action]');
  if (action) {
    selectGamepadTarget(action);
  }
}
