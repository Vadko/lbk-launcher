import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { t } from '@/shared/i18n/i18n';
import { formatBytes, parseSizeToBytes } from '../shared/formatters';
import { isExeInstaller } from '../shared/installer-kind';
import type { AchievementsDelivery } from '../shared/plugin-host-types';
import type {
  AchievementsComponent,
  DownloadProgress,
  Game,
  GamePath,
  InstallationInfo,
  InstallationStatus,
  InstallOptions,
  RunInstallerDecision,
  RunInstallerRequest,
} from '../shared/types';
import { syncAchievementsToPlugin } from './achievements';
import {
  commitAchievementStrings,
  type PreparedAchievements,
  prepareAchievements,
} from './achievements/install';
import { detectGamePath, getFirstAvailableGamePath } from './game-detector';
import { refreshXboxRootsForGame } from './game-detector/xbox';
import { backupFiles } from './installer/backup';
import { readInstallationInfo, saveInstallationInfo } from './installer/cache';
import { checkDiskSpace } from './installer/disk';
import { downloadAndExtractArchive } from './installer/download-and-extract';
import { applyEglIntegration } from './installer/egl-integration';
import { handleInstallationError } from './installer/error-handler';
import { ManualSelectionError, PausedSignal } from './installer/errors';
import { isExecutableInstaller } from './installer/executable';
import { cleanupDownloadDir, copyDirectory, getAllFiles } from './installer/files';
import { withAchievementsComponent } from './installer/installation-info';
import { resolveMacBundleTarget } from './installer/mac-bundle';
import { resignMacBundles } from './installer/mac-codesign';
import {
  checkPlatformCompatibility,
  getInstallerFileName,
  isWindowsInstallerFile,
  runInstaller,
} from './installer/platform';
import { findProtons } from './installer/proton';
import { applySteamIntegration } from './installer/steam-integration';
import { isCurrentSessionFirstLaunch } from './tracking';
import { resolveGameBuildOs } from './utils/game-build';
import { isLinux } from './utils/platform';

const mkdir = promisify(fs.mkdir);

type InstallTranslationResult = Awaited<ReturnType<typeof applySteamIntegration>> & {
  achievementsDelivery?: AchievementsDelivery;
};

// The shared tail: strings are written only once the install is about to be recorded, so a failed install leaves none behind.
async function finishInstall(i: {
  game: Game;
  gamePath: GamePath;
  onStatus?: (status: InstallationStatus) => void;
  existingInfo: InstallationInfo | null;
  achievements: PreparedAchievements;
  record: (achievements: AchievementsComponent | null) => InstallationInfo;
  // Runs between building the record and saving it; throwing there skips the save.
  beforeSave?: (info: InstallationInfo) => Promise<void>;
}): Promise<InstallTranslationResult> {
  const previous = i.existingInfo?.components?.achievements;
  const component = await commitAchievementStrings({
    extracted: i.achievements.extracted,
    gameId: i.game.id,
    archiveHash: i.achievements.archiveHash,
    component: i.achievements.component,
    previous:
      i.existingInfo && previous
        ? { gameId: i.existingInfo.gameId, component: previous }
        : null,
  });
  const info = i.record(component);
  const delivery = component || previous ? await syncAchievementsToPlugin() : undefined;
  await i.beforeSave?.(info);
  await saveInstallationInfo(i.gamePath.path, info);
  const steam = await applySteamIntegration(i.game, i.gamePath, i.onStatus);
  const egl = applyEglIntegration(i.game, i.gamePath);
  return { ...steam, ...egl, achievementsDelivery: component ? delivery : undefined };
}

/**
 * Main installation function
 */
export async function installTranslation(
  game: Game,
  options: InstallOptions,
  customGamePath?: string,
  onDownloadProgress?: (progress: DownloadProgress) => void,
  onStatus?: (status: InstallationStatus) => void,
  onConfirmRunInstaller?: (request: RunInstallerRequest) => Promise<RunInstallerDecision>
): Promise<InstallTranslationResult> {
  const { createBackup, installText, installVoice, installAchievements, platform } =
    options;

  try {
    console.log(`[Installer] ========== INSTALLATION START ==========`);
    console.log(`[Installer] Installing translation for: ${game.name} (${game.id})`);
    console.log(`[Installer] Options:`, JSON.stringify(options));

    // 1. Check platform compatibility for installer-based translations
    const platformError = checkPlatformCompatibility(game);
    if (platformError) {
      console.error(`[Installer] Platform incompatible: ${platformError}`);
      throw new Error(platformError);
    }

    // 2. Detect game installation path
    // If license_only is enabled, don't allow custom path selection
    if (game.license_only && customGamePath) {
      console.error(
        `[Installer] Manual selection not allowed for license-only game: ${game.id}`
      );
      throw new Error(t('installSteps.licenseOnlyManual'));
    }

    let gamePath: ReturnType<typeof getFirstAvailableGamePath>;
    if (!customGamePath) {
      await refreshXboxRootsForGame(game.install_paths);
    }
    if (customGamePath) {
      const customPlatform = platform === 'auto' ? 'steam' : platform;
      gamePath = { platform: customPlatform, path: customGamePath, exists: true };
    } else if (platform === 'auto') {
      gamePath = getFirstAvailableGamePath(game.install_paths || [], game.steam_app_id);
    } else {
      const selectedInstallPath = (game.install_paths || []).find(
        (p) => p.type === platform
      );
      gamePath = detectGamePath(selectedInstallPath, game.steam_app_id);
    }

    if (!gamePath || !gamePath.exists || !gamePath.path) {
      console.error(`[Installer] Game not found. Searched paths:`, game.install_paths);
      const platformPath = (game.install_paths || []).find(
        (p) => p.type === platform
      )?.path;

      // If license_only, show a different error message
      if (game.license_only) {
        throw new Error(t('installSteps.licenseOnlyNotFound'));
      }

      throw new ManualSelectionError(
        t('installSteps.gameNotFound', {
          path: platformPath || t('installSteps.pathNotSpecified'),
        })
      );
    }

    console.log(`[Installer] ✓ Game found at: ${gamePath.path} (${gamePath.platform})`);

    // Not the host OS: Linux Steam titles are mostly the Windows build under Proton.
    const buildOs = await resolveGameBuildOs(gamePath.path, game.steam_app_id, [
      game.installation_file_windows_path,
      game.installation_file_linux_path,
    ]);
    console.log(`[Installer] Installed game build: ${buildOs}`);

    // Checked before the download: a Windows installer on Linux is dead without Proton.
    const installerFileName = getInstallerFileName(game, buildOs);
    const needsProton =
      !!installerFileName && isLinux() && isWindowsInstallerFile(installerFileName);
    const protons = needsProton ? findProtons() : [];
    if (needsProton && protons.length === 0) {
      throw new Error(t('installSteps.protonMissing'));
    }

    // 3. Create temp directory on the same disk as the game (for correct disk space check and faster file operations)
    const downloadDir = path.join(gamePath.path, '.lbk-temp');
    await mkdir(downloadDir, { recursive: true });

    // 4. Check available disk space
    let requiredSpace = 0;
    if (installText) {
      // Pick the matching archive size in priority order:
      //   1. Variant matching the installed build (Linux/macOS) — any store.
      //   2. Store-specific variant (Epic/GOG/Xbox/Uplay/EA) — only if user is on that store.
      //   3. Main archive — default fallback (typically Windows).
      let textArchiveSize: string | null | undefined = game.archive_size;
      if (buildOs === 'linux' && game.steam_linux_archive_size) {
        textArchiveSize = game.steam_linux_archive_size;
      } else if (buildOs === 'macos' && game.steam_mac_archive_size) {
        textArchiveSize = game.steam_mac_archive_size;
      } else if (gamePath.platform === 'epic' && game.epic_archive_size) {
        textArchiveSize = game.epic_archive_size;
      } else if (gamePath.platform === 'gog' && game.gog_archive_size) {
        textArchiveSize = game.gog_archive_size;
      } else if (gamePath.platform === 'xbox' && game.xbox_archive_size) {
        textArchiveSize = game.xbox_archive_size;
      } else if (gamePath.platform === 'uplay' && game.uplay_archive_size) {
        textArchiveSize = game.uplay_archive_size;
      } else if (gamePath.platform === 'ea' && game.ea_archive_size) {
        textArchiveSize = game.ea_archive_size;
      }
      if (textArchiveSize) {
        requiredSpace += parseSizeToBytes(textArchiveSize);
      }
    }
    if (installVoice && game.voice_archive_size) {
      requiredSpace += parseSizeToBytes(game.voice_archive_size);
    }
    if (installAchievements && game.achievements_archive_size) {
      requiredSpace += parseSizeToBytes(game.achievements_archive_size);
    }

    if (requiredSpace > 0) {
      // 2x for archive + extracted (final copy uses rename, not copy, since same disk)
      const neededSpace = requiredSpace * 2;
      const diskSpace = await checkDiskSpace(gamePath.path);

      if (diskSpace < neededSpace) {
        // Cleanup temp dir before throwing
        await cleanupDownloadDir(downloadDir);
        throw new Error(
          t('installSteps.notEnoughSpace', {
            needed: formatBytes(neededSpace),
            available: formatBytes(diskSpace),
          })
        );
      }
      console.log(`[Installer] ✓ Disk space check passed`);
    }

    const extractDir = path.join(downloadDir, `${game.id}_extract`);

    // Check if this is first session (for conversion tracking)
    const isFirstSession = isCurrentSessionFirstLaunch();

    // 5.1 Download text archive if requested
    let textFiles: string[] = [];
    if (installText) {
      // Selection priority (matches the disk-space check above):
      //   1. Variant matching the installed build (Linux/macOS) — any store.
      //      Translator uploads these when files differ for Linux/macOS builds.
      //   2. Store-specific variant (Epic/GOG/Xbox/Uplay/EA) — only when user is on
      //      that store.
      //   3. Main archive — default fallback.
      let archivePath = game.archive_path;
      let archiveHash = game.archive_hash;

      if (buildOs === 'linux' && game.steam_linux_archive_path) {
        archivePath = game.steam_linux_archive_path;
        archiveHash = game.steam_linux_archive_hash;
        console.log('[Installer] Using Linux variant archive');
      } else if (buildOs === 'macos' && game.steam_mac_archive_path) {
        archivePath = game.steam_mac_archive_path;
        archiveHash = game.steam_mac_archive_hash;
        console.log('[Installer] Using macOS variant archive');
      } else if (gamePath.platform === 'epic' && game.epic_archive_path) {
        archivePath = game.epic_archive_path;
        archiveHash = game.epic_archive_hash;
        console.log('[Installer] Using Epic-specific archive');
      } else if (gamePath.platform === 'gog' && game.gog_archive_path) {
        archivePath = game.gog_archive_path;
        archiveHash = game.gog_archive_hash;
        console.log('[Installer] Using GOG-specific archive');
      } else if (gamePath.platform === 'xbox' && game.xbox_archive_path) {
        archivePath = game.xbox_archive_path;
        archiveHash = game.xbox_archive_hash;
        console.log('[Installer] Using Xbox-specific archive');
      } else if (gamePath.platform === 'uplay' && game.uplay_archive_path) {
        archivePath = game.uplay_archive_path;
        archiveHash = game.uplay_archive_hash;
        console.log('[Installer] Using Uplay-specific archive');
      } else if (gamePath.platform === 'ea' && game.ea_archive_path) {
        archivePath = game.ea_archive_path;
        archiveHash = game.ea_archive_hash;
        console.log('[Installer] Using EA-specific archive');
      }

      if (!archivePath) {
        const otherVariants = [
          game.steam_linux_archive_path ? 'Linux' : null,
          game.steam_mac_archive_path ? 'macOS' : null,
        ].filter((variant): variant is string => variant !== null);

        if (otherVariants.length > 0) {
          const buildLabel = { windows: 'Windows', linux: 'Linux', macos: 'macOS' }[
            buildOs
          ];
          throw new Error(
            t('installSteps.noArchiveForBuild', {
              build: buildLabel,
              variants: otherVariants.join(', '),
            })
          );
        }
      }

      textFiles = await downloadAndExtractArchive({
        game,
        type: 'text',
        archivePath,
        archiveHash,
        downloadDir,
        extractDir,
        isFirstSession,
        onDownloadProgress,
        onStatus,
        downloadContext: { options, platform: gamePath.platform, customGamePath },
      });
    }

    // 5.2 Download voice archive if requested
    let voiceFiles: string[] = [];
    if (installVoice && game.voice_archive_path) {
      const voiceExtractDir = path.join(downloadDir, `${game.id}_voice_extract`);
      voiceFiles = await downloadAndExtractArchive({
        game,
        type: 'voice',
        archivePath: game.voice_archive_path,
        archiveHash: game.voice_archive_hash,
        downloadDir,
        extractDir: voiceExtractDir,
        isFirstSession,
        onDownloadProgress,
        onStatus: (status) =>
          onStatus?.({
            message: t('installSteps.voiceStatus', { message: status.message }),
            phase: status.phase,
          }),
      });
      // Copy voice files to main extract directory
      await copyDirectory(voiceExtractDir, extractDir);
    }

    // 5.3 Achievements (Steam only)
    const existingInfo = readInstallationInfo(gamePath.path);
    const achievements = await prepareAchievements({
      game,
      platform: gamePath.platform,
      wanted: installAchievements,
      existing:
        existingInfo?.gameId === game.id
          ? existingInfo.components?.achievements
          : undefined,
      downloadDir,
      isFirstSession,
      onDownloadProgress,
      onStatus,
    });
    const finish = (
      record: (achievements: AchievementsComponent | null) => InstallationInfo,
      beforeSave?: (info: InstallationInfo) => Promise<void>
    ) =>
      finishInstall({
        game,
        gamePath,
        onStatus,
        existingInfo,
        achievements,
        record,
        beforeSave,
      });

    // 6. Check for executable installer
    if (installerFileName && isExecutableInstaller(installerFileName) && !installText) {
      // Achievements only: the shipped installer already ran and nothing was extracted to copy.
      await cleanupDownloadDir(downloadDir);
      return await finish((component) =>
        withAchievementsComponent(
          existingInfo?.gameId === game.id
            ? existingInfo
            : {
                gameId: game.id,
                version: game.version || '1.0.0',
                installedAt: new Date().toISOString(),
                gamePath: gamePath.path,
                hasBackup: false,
                isCustomPath: !!customGamePath,
                installedFiles: [],
                installedPlatform: gamePath.platform,
                components: { text: { installed: false, files: [] } },
              },
          component
        )
      );
    }

    if (installerFileName && isExecutableInstaller(installerFileName)) {
      const fullTargetPath = gamePath.path;
      console.log(`[Installer] Found executable installer: ${installerFileName}`);

      onStatus?.({ message: t('installSteps.copying'), phase: 'install' });
      await copyDirectory(extractDir, fullTargetPath);

      onStatus?.({ message: t('installSteps.cleaning'), phase: 'install' });
      await cleanupDownloadDir(downloadDir);

      const installerPath = path.join(fullTargetPath, installerFileName);
      const isExeFile = isExeInstaller(installerFileName);
      const context = isExeFile ? 'installer' : 'script';

      if (onConfirmRunInstaller) {
        onStatus?.({
          message: t('installSteps.awaitingConfirm', { context }),
          phase: 'install',
          tone: 'waiting',
        });
      }
      const decision: RunInstallerDecision = onConfirmRunInstaller
        ? await onConfirmRunInstaller({
            gameId: game.id,
            installerPath,
            isExe: isExeFile,
            protons: needsProton ? protons : undefined,
          })
        : { run: true };

      return await finish(
        (component) => ({
          gameId: game.id,
          version: game.version || '1.0.0',
          installedAt: new Date().toISOString(),
          gamePath: gamePath.path,
          hasBackup: false,
          isCustomPath: !!customGamePath,
          protonPath: decision.protonPath,
          installerPath,
          installedFiles: [],
          installedPlatform: gamePath.platform,
          components: {
            text: { installed: true, files: [] },
            ...(component ? { achievements: component } : {}),
          },
        }),
        async (installationInfo) => {
          if (!decision.run) {
            console.log('[Installer] User declined to run installer:', installerPath);
            await saveInstallationInfo(gamePath.path, {
              ...installationInfo,
              hasInstallError: true,
            });
            throw new Error(t('installSteps.runDeclined', { context }));
          }
          try {
            await runInstaller(
              fullTargetPath,
              installerFileName,
              onStatus,
              decision.protonPath
            );
          } catch (error) {
            await saveInstallationInfo(gamePath.path, {
              ...installationInfo,
              hasInstallError: true,
            });
            throw error;
          }
        }
      );
    }

    // 7. Copy files to game directory
    let additionalPath = game.additional_path || '';

    // On macOS, redirect the copy into the `.app` bundle (data lives inside it,
    // not at the game root). Skip when a macOS archive was used — it already
    // carries the bundle path.
    if (
      (installText || installVoice) &&
      buildOs === 'macos' &&
      !game.steam_mac_archive_path
    ) {
      const macBundle = await resolveMacBundleTarget(gamePath.path, extractDir);
      if (macBundle.target) {
        additionalPath = macBundle.target;
        console.log(`[Installer] macOS .app bundle — installing into: ${additionalPath}`);
      } else if (macBundle.appBundleFound && macBundle.matchedInsideBundle > 0) {
        throw new Error(t('installSteps.macBundleUnresolved'));
      }
    }

    const fullTargetPath = additionalPath
      ? path.join(gamePath.path, additionalPath)
      : gamePath.path;
    let installedFiles: string[] = [];
    let macSigningFailed = false;

    // Helper to prefix paths with additional_path
    const prefixPaths = (files: string[]) =>
      additionalPath ? files.map((f) => path.join(additionalPath, f)) : files;

    if (installText || installVoice) {
      installedFiles = await getAllFiles(extractDir);
      console.log(`[Installer] Will install ${installedFiles.length} files`);

      if (additionalPath) {
        console.log(`[Installer] Using additional_path: ${additionalPath}`);
        await mkdir(fullTargetPath, { recursive: true });
      }

      if (createBackup) {
        onStatus?.({ message: t('installSteps.backingUp'), phase: 'install' });
        await backupFiles(
          extractDir,
          fullTargetPath,
          undefined,
          additionalPath,
          gamePath.path
        );
      }

      onStatus?.({ message: t('installSteps.copying'), phase: 'install' });
      await copyDirectory(extractDir, fullTargetPath);

      // The files are already copied by this point, so a signing problem must
      // not abort the install — but it does leave the game unlaunchable, so it
      // is recorded as an install error rather than swallowed.
      try {
        macSigningFailed = !(await resignMacBundles(
          gamePath.path,
          prefixPaths(installedFiles),
          onStatus
        ));
      } catch (error) {
        console.error('[Installer] Re-signing macOS bundle failed:', error);
        macSigningFailed = true;
      }
    }

    // 8. Cleanup
    onStatus?.({ message: t('installSteps.cleaning'), phase: 'install' });
    await cleanupDownloadDir(downloadDir);

    // 9. Save installation info
    const result = await finish((component) => ({
      gameId: game.id,
      version: game.version || '1.0.0',
      installedAt: new Date().toISOString(),
      gamePath: gamePath.path,
      hasBackup: createBackup,
      isCustomPath: !!customGamePath,
      installedFiles: prefixPaths(installedFiles),
      installedPlatform: gamePath.platform,
      // Signing failed means the bundle is left unsigned and the game will be
      // killed on launch — not a success, even though every file is in place.
      ...(macSigningFailed ? { hasInstallError: true } : {}),
      components: {
        text: { installed: installText, files: prefixPaths(textFiles) },
        ...(installVoice && voiceFiles.length > 0
          ? { voice: { installed: true, files: prefixPaths(voiceFiles) } }
          : {}),
        ...(component ? { achievements: component } : {}),
      },
    }));
    console.log(`[Installer] Translation for ${game.id} installed successfully`);
    return result;
  } catch (error) {
    // Handle pause specially - throw PausedSignal for IPC handler
    if (error instanceof Error && error.message === 'PAUSED') {
      console.log('[Installer] Installation paused by user');
      throw new PausedSignal();
    }
    console.error('[Installer] Installation error:', error);
    handleInstallationError(error);
  }
}
