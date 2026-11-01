import { animate } from 'framer-motion';
import { useGamepadModeStore } from '../store/useGamepadModeStore';
import { getTopDialog } from './getTopDialog';
import { selectEntryAction } from './selectEntryAction';

const HIGHLIGHT_S = 1;

// The tint fades out, and with animations off it holds for its second
function highlight(element: HTMLElement, animationsEnabled: boolean): void {
  const main = getComputedStyle(element)
    .getPropertyValue('--color-main')
    .trim()
    .split(/\s+/);
  const lit = `rgba(${main.join(', ')}, 0.14)`;
  const clear = `rgba(${main.join(', ')}, 0)`;
  animate(
    element,
    {
      backgroundColor: [lit, lit, clear],
      boxShadow: [`0 0 0 8px ${lit}`, `0 0 0 8px ${lit}`, `0 0 0 8px ${clear}`],
    },
    {
      duration: HIGHLIGHT_S,
      ease: ['easeOut', 'easeOut'],
      times: animationsEnabled ? [0, 0.4, 1] : [0, 1, 1],
    }
  );
}

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
      highlight(element, animationsEnabled);
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
