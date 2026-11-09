import { ipcMain } from 'electron';
import { getMainWindow } from '@/main/window';
import {
  RESOURCES_CHANNEL,
  type ResourceKey,
  type ResourceSubscribe,
} from '@/shared/resources';
import { openResourceSession } from './resource-hub';

// The preload makes the channel and sends main its end; structured clone over a port keeps Map and Set
export function setupResourcePort(wanted: (key: ResourceKey) => void): void {
  ipcMain.on(RESOURCES_CHANNEL, ({ sender, ports: [port] }) => {
    if (!port) {
      return;
    }
    if (sender !== getMainWindow()?.webContents) {
      port.close();
      return;
    }
    const endSession = openResourceSession(port);
    port.on('message', ({ data }: { data: ResourceSubscribe }) =>
      data.subscribe.forEach(wanted)
    );
    port.on('close', endSession);
    port.start();
  });
}
