import { ipcMain, dialog, shell } from 'electron';
import { installTranslation, checkInstallation } from '../installer';
import { getMainWindow } from '../window';

export function setupInstallerHandlers(): void {
  ipcMain.handle(
    'install-translation',
    async (_, gameId: string, platform: string, customGamePath?: string) => {
      try {
        await installTranslation(gameId, platform, (progress) => {
          getMainWindow()?.webContents.send('install-progress', progress);
        }, customGamePath);
      } catch (error) {
        console.error('Error installing translation:', error);
        throw error;
      }
    }
  );

  ipcMain.handle('check-installation', async (_, gameId: string) => {
    try {
      return await checkInstallation(gameId);
    } catch (error) {
      console.error('Error checking installation:', error);
      return null;
    }
  });

  ipcMain.handle('open-external', async (_, url: string) => {
    await shell.openExternal(url);
  });

  ipcMain.handle('select-game-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Оберіть папку з грою',
      buttonLabel: 'Обрати',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });
}
