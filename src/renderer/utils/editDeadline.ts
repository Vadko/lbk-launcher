// The server takes an edit for 15 minutes after the entry was posted
const EDIT_WINDOW_MS = 15 * 60_000;

export function editDeadline(createdAt: string): number {
  return Date.parse(createdAt) + EDIT_WINDOW_MS;
}

// A server clock ahead of this one would otherwise round a fresh entry up to 16 minutes
export function editMinutesLeft(deadline: number, now: number): number {
  return Math.min(EDIT_WINDOW_MS / 60_000, Math.ceil((deadline - now) / 60_000));
}
