import { type IpcRendererEvent, ipcRenderer } from 'electron';

// Each builder takes its argument and result types from the API member it is assigned to

export function invoke<A extends unknown[], R>(
  channel: string
): (...args: A) => Promise<R> {
  return (...args) => ipcRenderer.invoke(channel, ...args);
}

export function send<A extends unknown[]>(channel: string): (...args: A) => void {
  return (...args) => ipcRenderer.send(channel, ...args);
}

// The disposer removes only this listener; removeAllListeners would drop every other subscriber of the channel
export function listen<A extends unknown[]>(
  channel: string
): (callback: (...args: A) => void) => () => void {
  return (callback) => {
    const handler = (_event: IpcRendererEvent, ...args: A) => callback(...args);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  };
}
