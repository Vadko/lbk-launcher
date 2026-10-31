import { useGamepadModeStore } from '../store/useGamepadModeStore';
import { getTopDialog } from './getTopDialog';
import { selectEntryAction } from './selectEntryAction';

const HIGHLIGHT_CLASS = 'review-focus';
const HIGHLIGHT_MS = 1000;

export function revealEntry(entryId: string, animationsEnabled: boolean): void {
  const element = document.getElementById(`review-${entryId}`);
  if (!element) {
    return;
  }
  element.scrollIntoView({
    block: 'center',
    behavior: animationsEnabled ? 'smooth' : 'instant',
  });
  // Static while animations are off, so the class itself has to go
  element.classList.add(HIGHLIGHT_CLASS);
  setTimeout(() => element.classList.remove(HIGHLIGHT_CLASS), HIGHLIGHT_MS);
  const gamepad = useGamepadModeStore.getState();
  if (!gamepad.isGamepadMode) {
    return;
  }
  // An action behind the backdrop would take the presses meant for the dialog, so the loop selects it on close
  if (getTopDialog()) {
    gamepad.handOverEntry(element.id);
  } else {
    selectEntryAction(element);
  }
}
