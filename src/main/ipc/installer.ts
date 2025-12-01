import { ipcMain, dialog, shell } from 'electron';
import { installTranslation, checkInstallation, uninstallTranslation } from '../installer';
import { getMainWindow } from '../window';

export function setupInstallerHandlers(): void {
  ipcMain.handle(
    'install-translation',
    async (_, gameId: string, platform: string, customGamePath?: string, createBackup?: boolean) => {
      try {
        await installTranslation(
          gameId,
          platform,
          customGamePath,
          createBackup,
          (downloadProgress) => {
            getMainWindow()?.webContents.send('download-progress', downloadProgress);
          },
          (status) => {
            getMainWindow()?.webContents.send('installation-status', status);
          }
        );
        return { success: true };
      } catch (error) {
        console.error('Error installing translation:', error);
        // Return error info instead of throwing to preserve custom properties
        return {
          success: false,
          error: {
            message: error instanceof Error ? error.message : 'Невідома помилка',
            needsManualSelection: error && typeof error === 'object' && 'needsManualSelection' in error
              ? (error as any).needsManualSelection
              : false,
          }
        };
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

  ipcMain.handle('uninstall-translation', async (_, gameId: string) => {
    try {
      await uninstallTranslation(gameId);
      return { success: true };
    } catch (error) {
      console.error('Error uninstalling translation:', error);
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Невідома помилка',
        },
      };
    }
  });
}
