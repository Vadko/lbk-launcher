import { dialog } from 'electron';
import { t } from '@/shared/i18n/i18n';
import type { AddWinePrefixResult } from '@/shared/wine-types';
import { getMainWindow } from '../window';
import { addUserWinePrefix, removeUserWinePrefix } from '../wine/prefixes';
import { createHandleOr } from './handle-or';

const handleOr = createHandleOr('Wine');

async function pickWinePrefix(): Promise<AddWinePrefixResult> {
  const window = getMainWindow();
  const options: Electron.OpenDialogOptions = {
    properties: ['openDirectory', 'showHiddenFiles'],
    title: t('settings.wine.pickTitle'),
    buttonLabel: t('settings.wine.pickButton'),
  };
  const result = window
    ? await dialog.showOpenDialog(window, options)
    : await dialog.showOpenDialog(options);
  const [dir] = result.filePaths;
  return result.canceled || !dir
    ? { success: false, error: 'cancelled' }
    : addUserWinePrefix(dir);
}

export function setupWineHandlers(): void {
  handleOr('wine:add-prefix', pickWinePrefix, () => ({
    success: false as const,
    error: 'failed' as const,
  }));
  handleOr('wine:remove-prefix', removeUserWinePrefix, () => undefined);
}
