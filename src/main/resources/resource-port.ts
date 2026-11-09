import { ipcMain, MessageChannelMain } from 'electron';
import { getMainWindow } from '@/main/window';
import { RESOURCES_CONNECT_CHANNEL, RESOURCES_PORT_CHANNEL } from '@/shared/resources';
import { openResourceSession } from './resource-hub';

// A port, not ipcRenderer events: its structured clone keeps Map and Set, which contextBridge copies away
export function setupResourcePort(): void {
  ipcMain.on(RESOURCES_CONNECT_CHANNEL, (event) => {
    if (event.sender !== getMainWindow()?.webContents) {
      return;
    }
    const { port1, port2 } = new MessageChannelMain();
    const session = openResourceSession(port1);
    port1.on('message', ({ data }) => session.receive(data));
    port1.on('close', session.end);
    port1.start();
    event.sender.postMessage(RESOURCES_PORT_CHANNEL, null, [port2]);
  });
}
