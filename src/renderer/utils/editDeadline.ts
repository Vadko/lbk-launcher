// The server takes an edit for 15 minutes after the entry was posted
const EDIT_WINDOW_MS = 15 * 60_000;

export function editDeadline(createdAt: string): number {
  return Date.parse(createdAt) + EDIT_WINDOW_MS;
}
