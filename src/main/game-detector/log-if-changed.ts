const lastMessages = new Map<string, string>();

// Store probes re-run on every window focus and filter open; repeating an unchanged result only floods the log
export function logIfChanged(
  key: string,
  message: string,
  level: 'log' | 'warn' = 'log'
): void {
  if (lastMessages.get(key) === message) {
    return;
  }
  lastMessages.set(key, message);
  console[level](message);
}
