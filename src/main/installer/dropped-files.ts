import fs from 'node:fs';
import path from 'node:path';
import { A, G } from '@mobily/ts-belt';
import { isPathInside } from '@/main/utils/fs-safe';
import { t } from '@/shared/i18n/i18n';
import type { InstallationInfo, InstallOptions } from '@/shared/types';
import { hasBackupOf, restoreBackupNew } from './backup';
import { deleteFileAndCleanupDirs } from './files';
import { rewriteInstallationRecord } from './installation-info';

type Reinstalled = Pick<InstallOptions, 'installText' | 'installVoice'>;

interface Component {
  installed: boolean;
  files: string[];
}

const filesOf = (component?: Component) => (component?.installed ? component.files : []);

// Files the previous version of a reinstalled component wrote that the new one no longer ships.
export function droppedFiles(
  gamePath: string,
  existing: InstallationInfo,
  reinstalled: Reinstalled,
  nextFiles: readonly string[]
): string[] {
  const { components } = existing;
  const text = components ? filesOf(components.text) : (existing.installedFiles ?? []);
  const voice = filesOf(components?.voice);
  const kept = new Set([
    ...nextFiles,
    ...(reinstalled.installText ? [] : text),
    ...(reinstalled.installVoice ? [] : voice),
  ]);
  // A.uniq and A.difference are quadratic, and a translation can ship tens of thousands of files.
  return [
    ...new Set([
      ...(reinstalled.installText ? text : []),
      ...(reinstalled.installVoice ? voice : []),
    ]),
  ].filter(
    // The folder's record is anyone's to write, and Kurin imports put booleans in `files`.
    (file) =>
      G.isString(file) &&
      !kept.has(file) &&
      isPathInside(gamePath, path.join(gamePath, file))
  );
}

// The record is rewritten only after the files are back, so a failed install never lists an original as ours.
export async function revertDroppedFiles(
  gamePath: string,
  existing: InstallationInfo,
  dropped: string[]
): Promise<{ record: InstallationInfo; reverted: string[] }> {
  const [restored, unbacked] = A.partition(dropped, (file) =>
    hasBackupOf(gamePath, file)
  );
  // Without a backup a replaced original cannot be told from an added file, so it stays.
  const added = existing.hasBackup === true ? unbacked : [];
  if (restored.length === 0 && added.length === 0) {
    return { record: existing, reverted: [] };
  }
  console.log(
    `[Installer] Reverting files the new version no longer ships: ${restored.length} restored, ${added.length} deleted`
  );
  for (const file of added) {
    const target = path.join(gamePath, file);
    await deleteFileAndCleanupDirs(target, gamePath);
    if (fs.existsSync(target)) {
      throw new Error(t('installSteps.revertFailed', { file }));
    }
  }
  await restoreBackupNew(gamePath, restored);

  const reverted = [...restored, ...added];
  const gone = new Set(reverted);
  const keep = (files: string[]) => files.filter((file) => !gone.has(file));
  const strip = <C extends Component>(component: C): C => ({
    ...component,
    files: keep(component.files),
  });
  const update = (info: InstallationInfo): InstallationInfo => ({
    ...info,
    installedFiles: info.installedFiles && keep(info.installedFiles),
    components: info.components && {
      ...info.components,
      text: strip(info.components.text),
      voice: info.components.voice && strip(info.components.voice),
    },
  });
  await rewriteInstallationRecord({ ...existing, gamePath }, update);
  return { record: update(existing), reverted };
}
