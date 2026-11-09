import { ipcRenderer } from 'electron';
import { RESOURCES_CHANNEL, type ResourcesAPI } from '../shared/resources';

// A contextBridge function cannot carry a port, so the page's end goes over a window message
export const resourcesAPI: ResourcesAPI = {
  connectResources: () => {
    const { port1, port2 } = new MessageChannel();
    ipcRenderer.postMessage(RESOURCES_CHANNEL, null, [port1]);
    window.postMessage(RESOURCES_CHANNEL, '*', [port2]);
  },
};
