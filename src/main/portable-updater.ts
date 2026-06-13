import { app, net } from 'electron';
import { getMainWindow } from './window';

const RELEASES_BASE = 'https://github.com/Vadko/lbk-launcher/releases';
const LATEST_YML_URL = `${RELEASES_BASE}/latest/download/latest.yml`;
const PORTABLE_ARTIFACT = 'LBK-Launcher-win-Portable.exe';

let updateCheckInterval: NodeJS.Timeout | null = null;

async function checkOnce(): Promise<void> {
  try {
    const res = await net.fetch(LATEST_YML_URL);
    if (!res.ok) return;
    const yml = await res.text();
    const remoteVersion = yml.match(/^version:\s*(\S+)/m)?.[1];
    if (!remoteVersion) return;
    if (remoteVersion.localeCompare(app.getVersion(), undefined, { numeric: true }) <= 0)
      return;

    const downloadUrl = `${RELEASES_BASE}/download/v${remoteVersion}/${PORTABLE_ARTIFACT}`;
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('update-available', { version: remoteVersion, downloadUrl });
    }
  } catch (err) {
    console.error('[PortableUpdater] Check failed:', err);
  }
}

export function checkForPortableUpdates(): void {
  if (!app.isPackaged) return;
  setTimeout(() => {
    checkOnce();
  }, 3000);
  updateCheckInterval = setInterval(() => {
    checkOnce();
  }, 1800000);
}

export function stopPortableUpdateCheck(): void {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
  }
}
