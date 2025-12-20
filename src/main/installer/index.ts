// Re-export all installer utilities
export { ManualSelectionError, RateLimitError } from './errors';
export { abortCurrentDownload, downloadFile, setDownloadAbortController, getDownloadAbortController } from './download';
export { extractArchive } from './archive';
export { backupFiles, restoreBackupLegacy, restoreBackupNew, cleanupEmptyDirectories, BACKUP_SUFFIX } from './backup';
export { getAllFiles, copyDirectory, cleanupDownloadDir, deleteDirectory } from './files';
export { checkPlatformCompatibility, getInstallerFileName, hasExecutableInstaller, runInstaller, getSteamAchievementsPath, isExecutableInstaller } from './platform';
export { verifyFileHash } from './hash';
export {
  saveInstallationInfo,
  checkInstallation,
  getPreviousInstallPath,
  invalidateInstalledGameIdsCache,
  removeOrphanedInstallationMetadata,
  getAllInstalledGameIds,
  deleteCachedInstallationInfo,
  INSTALLATION_INFO_FILE
} from './cache';
export { parseSizeToBytes, checkDiskSpace } from './disk';
