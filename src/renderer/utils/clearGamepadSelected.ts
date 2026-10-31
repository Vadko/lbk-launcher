export function clearGamepadSelected(): void {
  document.querySelectorAll('[data-gamepad-selected]').forEach((el) => {
    el.removeAttribute('data-gamepad-selected');
  });
}
