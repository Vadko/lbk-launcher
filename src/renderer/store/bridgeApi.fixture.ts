type Callback = (...args: unknown[]) => void;

// Every on* method records its callback, so a test can push that event; the rest answer from the given reads
export function fakeElectronApi(reads: Record<string, unknown>) {
  const listeners = new Map<string, Callback[]>();
  const subscribe = (event: string) => (callback: Callback) => {
    listeners.set(event, [...(listeners.get(event) ?? []), callback]);
    return () => undefined;
  };
  const api = new Proxy(reads, {
    get: (target, key) =>
      typeof key === 'string' && !(key in target) && key.startsWith('on')
        ? subscribe(key)
        : Reflect.get(target, key),
  });
  const emit = (event: string, ...args: unknown[]) => {
    for (const callback of listeners.get(event) ?? []) {
      callback(...args);
    }
  };
  return { api, emit };
}
