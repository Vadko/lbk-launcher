import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { formatBytes } from '../shared/formatters';
import type {
  DownloadProgress,
  Game,
  InstallationInfo,
  InstallationStatus,
  InstallOptions,
} from '../shared/types';
import { detectGamePath, getFirstAvailableGamePath } from './game-detector';
import { BACKUP_SUFFIX, backupFiles } from './installer/backup';
import { readInstallationInfo, saveInstallationInfo } from './installer/cache';
import { checkDiskSpace, parseSizeToBytes } from './installer/disk';
import { downloadAndExtractArchive } from './installer/download-and-extract';
import { handleInstallationError } from './installer/error-handler';
import { ManualSelectionError, PausedSignal } from './installer/errors';
import { cleanupDownloadDir, copyDirectory, getAllFiles } from './installer/files';
import { resolveMacBundleTarget } from './installer/mac-bundle';
import { resignMacBundles } from './installer/mac-codesign';
import {
  checkPlatformCompatibility,
  getInstallerFileName,
  getSteamAchievementsPath,
  hasExecutableInstaller,
  runInstaller,
} from './installer/platform';
import { isCurrentSessionFirstLaunch } from './tracking';
import { resolveGameBuildOs } from './utils/game-build';
import { applySteamArtwork } from './utils/steam-artwork';
import { writeSteamLaunchOptions } from './utils/steam-launch-options';

const mkdir = promisify(fs.mkdir);

/**
 * Main installation function
 */
export async function installTranslation(
  game: Game,
  options: InstallOptions,
  customGamePath?: string,
  onDownloadProgress?: (progress: DownloadProgress) => void,
  onStatus?: (status: InstallationStatus) => void,
  onConfirmRunInstaller?: (installerPath: string, isExe: boolean) => Promise<boolean>
): Promise<{ launchOptionsPending: boolean; achievementsChanged: boolean }> {
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
      throw new Error(
        `Встановлення цього перекладу доступне тільки для ліцензійної версії гри.\n\n` +
          `Ручний вибір папки заборонено.`
      );
    }

    let gamePath: ReturnType<typeof getFirstAvailableGamePath>;
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
        throw new Error(
          `Встановлення цього перекладу доступне тільки для ліцензійної версії гри.\n\n` +
            `Гру не знайдено. Переконайтеся, що ліцензійна версія гри встановлена через офіційний магазин (Steam, GOG, Epic Games, Ubisoft Connect, EA App тощо).`
        );
      }

      throw new ManualSelectionError(
        `Гру не знайдено\n\n` +
          `Ми не змогли автоматично визначити шлях до папки: ${platformPath || 'не вказано'}`
      );
    }

    console.log(`[Installer] ✓ Game found at: ${gamePath.path} (${gamePath.platform})`);

    // Not the host OS: Linux Steam titles are mostly the Windows build under Proton.
    const buildOs = await resolveGameBuildOs(gamePath.path, game.steam_app_id);
    console.log(`[Installer] Installed game build: ${buildOs}`);

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
          `Недостатньо місця на диску.\n\n` +
            `Необхідно: ${formatBytes(neededSpace)}\n` +
            `Доступно: ${formatBytes(diskSpace)}\n\n` +
            `Звільніть місце та спробуйте знову.`
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
            `Для встановленої збірки гри (${buildLabel}) немає архіву перекладу.\n\n` +
              `Переклад доступний лише для: ${otherVariants.join(', ')}.`
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
          onStatus?.({ message: `Озвучення: ${status.message}`, phase: status.phase }),
      });
      // Copy voice files to main extract directory
      await copyDirectory(voiceExtractDir, extractDir);
    }

    // 5.3 Download achievements archive if requested (Steam only)
    let achievementsFiles: string[] = [];
    let achievementsInstallPath: string | null = null;
    let achievementsChanged = false;
    console.log(`[Installer] Achievements check:`, {
      installAchievements,
      hasArchivePath: !!game.achievements_archive_path,
      archivePath: game.achievements_archive_path,
      platform: gamePath.platform,
    });
    // If the on-disk install already has the same achievement archive hash,
    // re-copying would write byte-identical files and the in-Steam state
    // wouldn't change — so we skip and suppress the restart prompt.
    const existingInfo = readInstallationInfo(gamePath.path);
    const existingAchievementHash = existingInfo?.components?.achievements?.archiveHash;
    const achievementsAlreadyUpToDate =
      installAchievements &&
      !!game.achievements_archive_hash &&
      existingAchievementHash === game.achievements_archive_hash &&
      existingInfo?.components?.achievements?.installed === true;
    if (achievementsAlreadyUpToDate) {
      console.log(
        `[Installer] Achievements already up-to-date (hash matches), skipping re-install`
      );
      achievementsFiles = existingInfo?.components?.achievements?.files || [];
      achievementsInstallPath = await getSteamAchievementsPath();
    }
    if (
      installAchievements &&
      game.achievements_archive_path &&
      gamePath.platform === 'steam' &&
      !achievementsAlreadyUpToDate
    ) {
      achievementsChanged = true;
      const achievementsExtractDir = path.join(
        downloadDir,
        `${game.id}_achievements_extract`
      );
      achievementsFiles = await downloadAndExtractArchive({
        game,
        type: 'achievements',
        archivePath: game.achievements_archive_path,
        archiveHash: game.achievements_archive_hash,
        downloadDir,
        extractDir: achievementsExtractDir,
        isFirstSession,
        onDownloadProgress,
        onStatus: (status) =>
          onStatus?.({ message: `Досягнення: ${status.message}`, phase: status.phase }),
      });

      achievementsInstallPath = await getSteamAchievementsPath();
      if (achievementsInstallPath) {
        console.log(`[Installer] Installing achievements to: ${achievementsInstallPath}`);
        onStatus?.({ message: 'Копіювання перекладу досягнень...', phase: 'install' });
        await mkdir(achievementsInstallPath, { recursive: true });

        // Find all achievement files (ignore folder structure from archive)
        const allExtractedFiles = await getAllFiles(achievementsExtractDir);
        const achievementFilesToCopy: { src: string; dest: string }[] = [];

        for (const relativePath of allExtractedFiles) {
          const fileName = path.basename(relativePath);
          const srcPath = path.join(achievementsExtractDir, relativePath);
          const destPath = path.join(achievementsInstallPath, fileName);
          achievementFilesToCopy.push({ src: srcPath, dest: destPath });
        }

        // Backup original achievement files (using _backup suffix)
        if (createBackup) {
          for (const { dest } of achievementFilesToCopy) {
            const backupPath = dest + BACKUP_SUFFIX;
            // Only backup if original exists and backup doesn't exist yet
            if (fs.existsSync(dest) && !fs.existsSync(backupPath)) {
              await fs.promises.copyFile(dest, backupPath);
              console.log(`[Installer] Backed up: ${path.basename(dest)}`);
            }
          }
        }

        // Copy files directly to achievements folder (flatten structure)
        for (const { src, dest } of achievementFilesToCopy) {
          await fs.promises.copyFile(src, dest);
          console.log(`[Installer] Copied achievement file: ${path.basename(dest)}`);
        }

        // Update achievementsFiles to contain only filenames (for installation info)
        achievementsFiles = achievementFilesToCopy.map(({ dest }) => path.basename(dest));
      }
    }

    // 6. Check for executable installer
    const installerFileName = getInstallerFileName(game, buildOs);
    const isExeInstaller = hasExecutableInstaller(game);

    if (installerFileName && isExeInstaller) {
      const fullTargetPath = gamePath.path;
      console.log(`[Installer] Found executable installer: ${installerFileName}`);

      onStatus?.({ message: 'Копіювання файлів українізатора...', phase: 'install' });
      await copyDirectory(extractDir, fullTargetPath);

      onStatus?.({ message: 'Очищення тимчасових файлів...', phase: 'install' });
      await cleanupDownloadDir(downloadDir);

      const installerPath = path.join(fullTargetPath, installerFileName);
      // "Installer" (.exe) vs "script" (.bat/.sh/etc.) label, matching the
      // distinction the renderer already draws (ImportantNotice, install confirm).
      const isExeFile = !!game.installation_file_windows_path?.endsWith('.exe');
      const installerLabel = isExeFile ? 'інсталятор' : 'скрипт';
      const installationInfo: InstallationInfo = {
        gameId: game.id,
        version: game.version || '1.0.0',
        installedAt: new Date().toISOString(),
        gamePath: gamePath.path,
        hasBackup: false,
        isCustomPath: !!customGamePath,
        protonPath: options.protonPath,
        installerPath,
        installedFiles: [],
        installedPlatform: gamePath.platform,
        components: { text: { installed: true, files: [] } },
      };

      if (onConfirmRunInstaller) {
        onStatus?.({
          message: `Очікування підтвердження запуску ${installerLabel}а...`,
          phase: 'install',
        });
      }
      const shouldRunInstaller = onConfirmRunInstaller
        ? await onConfirmRunInstaller(installerPath, isExeFile)
        : true;

      if (!shouldRunInstaller) {
        console.log('[Installer] User declined to run installer:', installerPath);
        await saveInstallationInfo(gamePath.path, {
          ...installationInfo,
          hasInstallError: true,
        });
        throw new Error(
          `Встановлення скасовано: запуск ${installerLabel}а було відхилено.\n\nФайли розпаковано в папку гри — ви можете запустити ${installerLabel} пізніше кнопкою «Перевстановити».`
        );
      }

      try {
        await runInstaller(
          fullTargetPath,
          installerFileName,
          onStatus,
          options.protonPath
        );

        await saveInstallationInfo(gamePath.path, installationInfo);
      } catch (error) {
        await saveInstallationInfo(gamePath.path, {
          ...installationInfo,
          hasInstallError: true,
        });
        throw error;
      }
      return { launchOptionsPending: false, achievementsChanged };
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
        throw new Error(
          'Не вдалося визначити місце встановлення всередині macOS-бандла (.app).\n\n' +
            'Для цієї гри потрібен окремий macOS-архів перекладу.'
        );
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
        onStatus?.({ message: 'Створення резервної копії...', phase: 'install' });
        await backupFiles(
          extractDir,
          fullTargetPath,
          undefined,
          additionalPath,
          gamePath.path
        );
      }

      onStatus?.({ message: 'Копіювання файлів українізатора...', phase: 'install' });
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
    onStatus?.({ message: 'Очищення тимчасових файлів...', phase: 'install' });
    await cleanupDownloadDir(downloadDir);

    // 9. Save installation info
    const installationInfo: InstallationInfo = {
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
        ...(installAchievements && achievementsFiles.length > 0 && achievementsInstallPath
          ? {
              achievements: {
                installed: true,
                files: achievementsFiles,
                archiveHash: game.achievements_archive_hash || undefined,
              },
            }
          : {}),
      },
    };
    await saveInstallationInfo(gamePath.path, installationInfo);

    // 10. Write Steam LaunchOptions if applicable (Steam-only, when configured by translator)
    let launchOptionsPending = false;
    if (
      gamePath.platform === 'steam' &&
      game.steam_app_id &&
      (game.steam_launch_options_windows || game.steam_launch_options_linux)
    ) {
      onStatus?.({
        message: 'Налаштування параметрів запуску Steam...',
        phase: 'install',
      });
      const result = await writeSteamLaunchOptions({
        appId: game.steam_app_id,
        windowsOptions: game.steam_launch_options_windows,
        linuxOptions: game.steam_launch_options_linux,
      });
      console.log(
        `[Installer] Steam LaunchOptions mode=${result.mode}${result.reason ? ` — ${result.reason}` : ''}`
      );
      launchOptionsPending = result.mode === 'needs-shutdown';
    }

    // 11. Ukrainian library artwork (Steam-only). Never fail an install over it.
    if (
      gamePath.platform === 'steam' &&
      game.steam_app_id &&
      (game.capsule_path || game.banner_path || game.logo_path)
    ) {
      onStatus?.({
        message: 'Встановлення українських обкладинок Steam...',
        phase: 'install',
      });
      try {
        const artwork = await applySteamArtwork({
          appId: game.steam_app_id,
          capsulePath: game.capsule_path,
          bannerPath: game.banner_path,
          logoPath: game.logo_path,
          updatedAt: game.updated_at,
        });
        console.log(
          `[Installer] Steam artwork mode=${artwork.mode}${artwork.installed.length ? ` — ${artwork.installed.join(', ')}` : ''}${artwork.reason ? ` — ${artwork.reason}` : ''}`
        );
      } catch (artworkError) {
        console.warn('[Installer] Steam artwork failed:', artworkError);
      }
    }

    console.log(`[Installer] Translation for ${game.id} installed successfully`);
    return { launchOptionsPending, achievementsChanged };
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
