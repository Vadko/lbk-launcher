export function getTopDialog(): HTMLElement | null {
  const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]');
  return dialogs[dialogs.length - 1] ?? null;
}
