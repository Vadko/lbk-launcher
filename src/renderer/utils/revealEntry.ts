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
  // A smooth scroll down a long game page outlasts the highlight, so it starts once the scroll has stopped
  void element
    .scrollIntoView({
      block: 'center',
      behavior: animationsEnabled ? 'smooth' : 'instant',
    })
    .then(({ interrupted }) => {
      // A newer reveal or the player's own scroll took over, so this entry stays unlit
      if (interrupted) {
        return;
      }
      element.classList.add(HIGHLIGHT_CLASS);
      // Static while animations are off, so the class itself has to go
      setTimeout(() => element.classList.remove(HIGHLIGHT_CLASS), HIGHLIGHT_MS);
    });
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
