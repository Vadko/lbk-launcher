import { contextBridge, type IpcRendererEvent, ipcRenderer } from 'electron';
import { CAPTCHA_CHANNELS } from '../shared/captcha-channels';

// The remote captcha page gets exactly the calls its script makes, never ipcRenderer or an IPC event; main checks every argument
contextBridge.exposeInMainWorld('lbkCaptchaHost', {
  onRequest: (listener: (request: unknown) => void) => {
    const handler = (_event: IpcRendererEvent, request: unknown) => listener(request);
    ipcRenderer.on(CAPTCHA_CHANNELS.request, handler);
    return () => {
      ipcRenderer.removeListener(CAPTCHA_CHANNELS.request, handler);
    };
  },
  ready: () => {
    ipcRenderer.send(CAPTCHA_CHANNELS.ready);
  },
  unavailable: (code: unknown) => {
    ipcRenderer.send(CAPTCHA_CHANNELS.unavailable, code);
  },
  resolve: (requestId: unknown, token: unknown) => {
    ipcRenderer.send(CAPTCHA_CHANNELS.resolve, requestId, token);
  },
  reject: (requestId: unknown, code: unknown) => {
    ipcRenderer.send(CAPTCHA_CHANNELS.reject, requestId, code);
  },
});
