export interface DialogFocusEntry {
  dialog: HTMLElement;
  // What had the gamepad when this dialog opened over it
  opener: HTMLElement | null;
}

type DialogFocusChange =
  | { kind: 'same' }
  | { kind: 'opened' }
  // A dialog above `top` closed: the gamepad goes back to what opened it
  | { kind: 'returned'; opener: HTMLElement | null }
  | { kind: 'closed'; opener: HTMLElement | null };

interface DialogFocusStep {
  stack: DialogFocusEntry[];
  change: DialogFocusChange;
}

// One step per frame of the stack of open dialogs, bottom first, against the top dialog in the document.
export function nextDialogFocus(
  stack: DialogFocusEntry[],
  top: HTMLElement | null,
  focused: HTMLElement | null
): DialogFocusStep {
  if ((stack.at(-1)?.dialog ?? null) === top) {
    return { stack, change: { kind: 'same' } };
  }
  if (top === null) {
    return { stack: [], change: { kind: 'closed', opener: stack[0]?.opener ?? null } };
  }
  const index = stack.findIndex((entry) => entry.dialog === top);
  if (index !== -1) {
    return {
      stack: stack.slice(0, index + 1),
      change: { kind: 'returned', opener: stack[index + 1].opener },
    };
  }
  // A dialog that closed in the same frame hands its opener to the one that took its place
  const open = stack.filter((entry) => entry.dialog.isConnected);
  const replaced = stack.find((entry) => !entry.dialog.isConnected);
  const opener =
    focused?.isConnected && !top.contains(focused) ? focused : (replaced?.opener ?? null);
  return { stack: [...open, { dialog: top, opener }], change: { kind: 'opened' } };
}
