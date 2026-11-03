const NON_TEXT_TYPES = ['checkbox', 'radio', 'button', 'submit', 'reset', 'range'];

export function isTextInput(
  el: Element | null
): el is HTMLInputElement | HTMLTextAreaElement {
  if (el instanceof HTMLTextAreaElement) {
    return true;
  }
  if (el instanceof HTMLInputElement) {
    return !el.readOnly && !NON_TEXT_TYPES.includes(el.type);
  }
  return false;
}
