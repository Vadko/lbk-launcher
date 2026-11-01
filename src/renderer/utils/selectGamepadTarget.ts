import { clearGamepadSelected } from './clearGamepadSelected';
import { isTextInput } from './isTextInput';

// Text fields only get a visual selection, so the on-screen keyboard opens on A, not on pass-through
export function selectGamepadTarget(el: HTMLElement): void {
  clearGamepadSelected();
  if (isTextInput(el)) {
    (document.activeElement as HTMLElement | null)?.blur?.();
    el.setAttribute('data-gamepad-selected', 'true');
  } else {
    el.focus({ preventScroll: true });
  }
}
