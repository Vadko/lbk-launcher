import { useState, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { useModalStore } from '../store/useModalStore';
import { useConfirmStore } from '../store/useConfirmStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useSubscriptionsStore } from '../store/useSubscriptionsStore';
import type {
  Game,
  InstallResult,
  DownloadProgress,
  InstallOptions,
  InstallationInfo,
  ConflictingTranslation,
} from '../../shared/types';

interface UseInstallationParams {
  selectedGame: Game | null;
  isUpdateAvailable: boolean;
  installationInfo: InstallationInfo | undefined;
  isOnline: boolean;
  isCheckingInstallation: boolean;
  onFirstInstallComplete?: () => void;
}

interface UseInstallationResult {
  isInstalling: boolean;
  isUninstalling: boolean;
  isPaused: boolean;
  installProgress: number;
  downloadProgress: DownloadProgress | null;
  statusMessage: string | null;
  handleInstall: (customGamePath?: string) => Promise<void>;
  handleInstallOptionsConfirm: (
    installOptions: InstallOptions,
    removeOptions: { removeVoice: boolean; removeAchievements: boolean }
  ) => Promise<void>;
  handleUninstall: () => Promise<void>;
  handlePauseDownload: () => Promise<void>;
  handleResumeDownload: () => Promise<void>;
  handleCancelDownload: () => Promise<void>;
  getInstallButtonText: () => string;
  showInstallOptions: boolean;
  setShowInstallOptions: (show: boolean) => void;
  pendingInstallPath: string | undefined;
}

export function useInstallation({
  selectedGame,
  isUpdateAvailable,
  installationInfo,
  isOnline,
  isCheckingInstallation,
  onFirstInstallComplete,
}: UseInstallationParams): UseInstallationResult {
  const {
    getInstallationProgress,
    setInstallationProgress,
    clearInstallationProgress,
    checkInstallationStatus,
  } = useStore();

  const { showModal } = useModalStore();
  const { showConfirm } = useConfirmStore();
  const { createBackupBeforeInstall } = useSettingsStore();

  const [showInstallOptions, setShowInstallOptions] = useState(false);
  const [pendingInstallPath, setPendingInstallPath] = useState<string | undefined>();
  const [pendingInstallOptions, setPendingInstallOptions] = useState<
    InstallOptions | undefined
  >();

  const gameProgress = selectedGame
    ? getInstallationProgress(selectedGame.id)
    : undefined;
  const isInstalling = gameProgress?.isInstalling || false;
  const isUninstalling = gameProgress?.isUninstalling || false;
  const isPaused = gameProgress?.isPaused || false;
  const installProgress = gameProgress?.progress || 0;
  const downloadProgress = gameProgress?.downloadProgress || null;
  const statusMessage = gameProgress?.statusMessage || null;

  const isPlanned = selectedGame?.status === 'planned';

  const performInstallation = useCallback(
    async (customGamePath?: string, options?: InstallOptions) => {
      if (!selectedGame) return;

      const platform = selectedGame.platforms[0] || 'steam';
      const effectiveOptions: InstallOptions = options ??
        pendingInstallOptions ?? {
          createBackup: createBackupBeforeInstall,
          installText: true,
          installVoice: false,
          installAchievements: false,
        };

      if (options) {
        setPendingInstallOptions(options);
      }

      // For emulator, always require manual folder selection
      if (platform === 'emulator' && !customGamePath) {
        showConfirm({
          title: 'Виберіть папку з грою',
          message:
            'Для емуляторів потрібно вручну вказати папку з грою.\n\nВиберіть папку з грою?',
          confirmText: 'Вибрати папку',
          cancelText: 'Скасувати',
          onConfirm: async () => {
            const selectedFolder = await window.electronAPI.selectGameFolder();
            if (selectedFolder) {
              await performInstallation(selectedFolder, effectiveOptions);
            }
          },
        });
        return;
      }

      try {
        setInstallationProgress(selectedGame.id, {
          isInstalling: true,
          progress: 0,
          downloadProgress: null,
          statusMessage: null,
        });

        window.electronAPI.onDownloadProgress?.((progress: DownloadProgress) => {
          setInstallationProgress(selectedGame.id, {
            progress: progress.percent,
            downloadProgress: progress,
          });
        });

        window.electronAPI.onInstallationStatus?.((status) => {
          setInstallationProgress(selectedGame.id, {
            statusMessage: status.message,
          });
        });

        const result: InstallResult = await window.electronAPI.installTranslation(
          selectedGame,
          platform,
          effectiveOptions,
          customGamePath
        );

        // Handle pause - not an error, just stop without clearing progress
        if (result.paused) {
          // Don't clear progress - keep the paused state visible
          return;
        }

        if (!result.success && result.error) {
          if (result.error.needsManualSelection) {
            showConfirm({
              title: 'Гру не знайдено',
              message: `${result.error.message}\n\nБажаєте вибрати папку з грою вручну?`,
              confirmText: 'Вибрати папку',
              cancelText: 'Скасувати',
              onConfirm: async () => {
                const selectedFolder = await window.electronAPI.selectGameFolder();
                if (selectedFolder) {
                  await performInstallation(selectedFolder, effectiveOptions);
                }
              },
            });
          } else if (result.error.isRateLimit) {
            showModal({
              title: 'Ліміт завантажень',
              message: result.error.message,
              type: 'info',
            });
          } else {
            showModal({
              title: 'Помилка встановлення',
              message: result.error.message,
              type: 'error',
            });
          }
          clearInstallationProgress(selectedGame.id);
          return;
        }

        setPendingInstallOptions(undefined);
        useStore.getState().clearGameUpdate(selectedGame.id);
        // Clear notified version so next version update will show notification again
        useSubscriptionsStore.getState().clearNotifiedVersion(selectedGame.id);

        let message = isUpdateAvailable
          ? `Українізатор ${selectedGame.name} успішно оновлено до версії ${selectedGame.version}!`
          : `Українізатор ${selectedGame.name} успішно встановлено!`;

        if (effectiveOptions.installAchievements) {
          message += '\n\nДля застосування перекладу досягнень перезапустіть Steam.';
        }

        showModal({
          title: isUpdateAvailable ? 'Українізатор оновлено' : 'Українізатор встановлено',
          message,
          type: 'success',
          actions: [
            {
              label: 'Перезапустити Steam',
              onClick: () => {
                window.electronAPI.restartSteam();
              },
              variant: 'primary',
            },
            {
              label: 'Зрозуміло',
              onClick: () => undefined,
              variant: 'secondary',
            },
          ],
        });

        // Trigger callback for first install (not update)
        if (!isUpdateAvailable && onFirstInstallComplete) {
          onFirstInstallComplete();
        }

        clearInstallationProgress(selectedGame.id);
      } catch (error) {
        console.error('Installation error:', error);
        showModal({
          title: 'Помилка встановлення',
          message: error instanceof Error ? error.message : 'Невідома помилка',
          type: 'error',
        });
        clearInstallationProgress(selectedGame.id);
      }
    },
    [
      selectedGame,
      isUpdateAvailable,
      createBackupBeforeInstall,
      pendingInstallOptions,
      setInstallationProgress,
      clearInstallationProgress,
      showModal,
      showConfirm,
      onFirstInstallComplete,
    ]
  );

  const handleConflictingTranslation = useCallback(
    async (conflict: ConflictingTranslation): Promise<boolean> =>
      new Promise((resolve) => {
        const teamInfo = conflict.team ? ` (${conflict.team})` : '';
        showConfirm({
          title: 'Інша локалізація вже встановлена',
          message: `У папці гри вже встановлено іншу локалізацію:\n\n"${conflict.gameName}"${teamInfo}\nВерсія: ${conflict.version}\n\nЩоб встановити нову локалізацію, потрібно спочатку видалити попередню.\n\nВидалити попередню локалізацію?`,
          confirmText: 'Видалити і продовжити',
          cancelText: 'Скасувати',
          onConfirm: async () => {
            try {
              // Get conflicting game info
              const [conflictingGame] = await window.electronAPI.fetchGamesByIds([
                conflict.gameId,
              ]);

              if (!conflictingGame) {
                showModal({
                  title: 'Помилка',
                  message: 'Не вдалося знайти інформацію про встановлену локалізацію.',
                  type: 'error',
                });
                resolve(false);
                return;
              }

              // Uninstall conflicting translation
              const result =
                await window.electronAPI.uninstallTranslation(conflictingGame);

              if (!result.success) {
                showModal({
                  title: 'Помилка видалення',
                  message:
                    result.error?.message || 'Не вдалося видалити попередню локалізацію.',
                  type: 'error',
                });
                resolve(false);
                return;
              }

              // Refresh installed translations cache
              await useStore.getState().loadInstalledGamesFromSystem();

              resolve(true);
            } catch (error) {
              console.error('Error removing conflicting translation:', error);
              showModal({
                title: 'Помилка',
                message:
                  error instanceof Error
                    ? error.message
                    : 'Не вдалося видалити попередню локалізацію.',
                type: 'error',
              });
              resolve(false);
            }
          },
          onCancel: () => {
            resolve(false);
          },
        });
      }),
    [showConfirm, showModal]
  );

  const handleInstall = useCallback(
    async (customGamePath?: string) => {
      if (!selectedGame || isInstalling || isCheckingInstallation) return;

      if (!isOnline) {
        showModal({
          title: 'Немає підключення',
          message: 'Перевірте підключення до Інтернету та спробуйте ще раз.',
          type: 'error',
        });
        return;
      }

      if (!window.electronAPI) {
        showModal({
          title: 'Недоступно',
          message: 'Встановлення доступне тільки в десктопній версії застосунку',
          type: 'error',
        });
        return;
      }

      // Check for conflicting translation (different translation of the same game)
      const conflict = await window.electronAPI.getConflictingTranslation(selectedGame);
      if (conflict) {
        const shouldContinue = await handleConflictingTranslation(conflict);
        if (!shouldContinue) {
          return;
        }
      }

      setPendingInstallPath(customGamePath);
      setShowInstallOptions(true);
    },
    [
      selectedGame,
      isInstalling,
      isCheckingInstallation,
      isOnline,
      showModal,
      handleConflictingTranslation,
    ]
  );

  const handleInstallOptionsConfirm = useCallback(
    async (
      installOptions: InstallOptions,
      removeOptions: { removeVoice: boolean; removeAchievements: boolean }
    ) => {
      if (!selectedGame) return;

      // First, remove components if requested
      if (removeOptions.removeVoice || removeOptions.removeAchievements) {
        try {
          setInstallationProgress(selectedGame.id, {
            isInstalling: true,
            statusMessage: 'Видалення компонентів...',
          });

          const result = await window.electronAPI.removeComponents(selectedGame, {
            voice: removeOptions.removeVoice,
            achievements: removeOptions.removeAchievements,
          });

          if (!result.success) {
            showModal({
              title: 'Помилка видалення',
              message: result.error?.message || 'Не вдалося видалити компоненти',
              type: 'error',
            });
            clearInstallationProgress(selectedGame.id);
            return;
          }

          await checkInstallationStatus(selectedGame.id, selectedGame);
        } catch (error) {
          console.error('Error removing components:', error);
          showModal({
            title: 'Помилка видалення',
            message: error instanceof Error ? error.message : 'Невідома помилка',
            type: 'error',
          });
          clearInstallationProgress(selectedGame.id);
          return;
        }
      }

      // If only removing components (no new downloads needed), we're done
      const needsDownload =
        !installationInfo ||
        installOptions.installText ||
        (installOptions.installVoice &&
          !installationInfo?.components?.voice?.installed) ||
        (installOptions.installAchievements &&
          !installationInfo?.components?.achievements?.installed);

      if (
        !needsDownload &&
        (removeOptions.removeVoice || removeOptions.removeAchievements)
      ) {
        clearInstallationProgress(selectedGame.id);
        showModal({
          title: 'Компоненти видалено',
          message: 'Вибрані компоненти успішно видалено.',
          type: 'success',
        });
        return;
      }

      // Proceed with installation if needed
      const hasInstaller =
        selectedGame.installation_file_windows_path ||
        selectedGame.installation_file_linux_path;

      if (hasInstaller) {
        showConfirm({
          title: 'Запуск інсталятора',
          message:
            'Після завантаження та розпакування українізатора буде запущено інсталятор.\n\nПродовжити встановлення?',
          confirmText: 'Продовжити',
          cancelText: 'Скасувати',
          onConfirm: async () => {
            await performInstallation(pendingInstallPath, installOptions);
          },
        });
        return;
      }

      await performInstallation(pendingInstallPath, installOptions);
    },
    [
      selectedGame,
      pendingInstallPath,
      performInstallation,
      showConfirm,
      showModal,
      installationInfo,
      setInstallationProgress,
      clearInstallationProgress,
      checkInstallationStatus,
    ]
  );

  const handleUninstall = useCallback(async () => {
    if (!selectedGame || !installationInfo) return;

    const hasBackup = installationInfo.hasBackup !== false;
    const backupWarning = !hasBackup
      ? '\n\n⚠️ УВАГА: Резервну копію не було створено при встановленні. Оригінальні файли НЕ будуть відновлені!'
      : '\n\nОригінальні файли гри будуть відновлені з резервної копії.';

    showConfirm({
      title: 'Видалення українізатора',
      message: `Ви впевнені, що хочете видалити українізатор для "${selectedGame.name}"?${backupWarning}`,
      confirmText: 'Видалити',
      cancelText: 'Скасувати',
      onConfirm: async () => {
        try {
          setInstallationProgress(selectedGame.id, {
            isUninstalling: true,
          });

          const result: InstallResult =
            await window.electronAPI.uninstallTranslation(selectedGame);

          if (!result.success && result.error) {
            showModal({
              title: 'Помилка видалення',
              message: result.error.message,
              type: 'error',
            });
            return;
          }

          // Clear notified version so future installs will get notifications
          useSubscriptionsStore.getState().clearNotifiedVersion(selectedGame.id);

          showModal({
            title: 'Українізатор видалено',
            message: `Українізатор "${selectedGame.name}" успішно видалено!`,
            type: 'success',
          });
        } catch (error) {
          console.error('Uninstall error:', error);
          showModal({
            title: 'Помилка видалення',
            message: error instanceof Error ? error.message : 'Невідома помилка',
            type: 'error',
          });
        } finally {
          clearInstallationProgress(selectedGame.id);
        }
      },
    });
  }, [
    selectedGame,
    installationInfo,
    setInstallationProgress,
    clearInstallationProgress,
    showModal,
    showConfirm,
  ]);

  const handlePauseDownload = useCallback(async () => {
    if (!selectedGame || !isInstalling || isPaused) return;

    if (!window.electronAPI?.pauseDownload) {
      console.warn('[useInstallation] pauseDownload not available');
      return;
    }

    const result = await window.electronAPI.pauseDownload(selectedGame.id);
    if (result.success) {
      setInstallationProgress(selectedGame.id, {
        isPaused: true,
        statusMessage: 'Завантаження призупинено',
      });
    } else {
      showModal({
        title: 'Помилка',
        message: result.error || 'Не вдалося призупинити завантаження',
        type: 'error',
      });
    }
  }, [selectedGame, isInstalling, isPaused, setInstallationProgress, showModal]);

  const handleResumeDownload = useCallback(async () => {
    if (!selectedGame || !isPaused) return;

    if (!window.electronAPI?.resumeDownload) {
      console.warn('[useInstallation] resumeDownload not available');
      return;
    }

    setInstallationProgress(selectedGame.id, {
      isPaused: false,
      statusMessage: 'Продовження завантаження...',
    });

    // Set up progress listeners again
    window.electronAPI.onDownloadProgress?.((progress: DownloadProgress) => {
      setInstallationProgress(selectedGame.id, {
        progress: progress.percent,
        downloadProgress: progress,
      });
    });

    window.electronAPI.onInstallationStatus?.((status) => {
      setInstallationProgress(selectedGame.id, {
        statusMessage: status.message,
      });
    });

    const result = await window.electronAPI.resumeDownload(selectedGame.id);
    if (!result.success) {
      showModal({
        title: 'Помилка',
        message: result.error || 'Не вдалося продовжити завантаження',
        type: 'error',
      });
      clearInstallationProgress(selectedGame.id);
    }
  }, [
    selectedGame,
    isPaused,
    setInstallationProgress,
    clearInstallationProgress,
    showModal,
  ]);

  const handleCancelDownload = useCallback(async () => {
    if (!selectedGame) return;

    if (isPaused) {
      // Cancel paused download
      await window.electronAPI.cancelPausedDownload(selectedGame.id);
    } else if (isInstalling) {
      // Abort active download
      await window.electronAPI.abortDownload();
    }

    clearInstallationProgress(selectedGame.id);
  }, [selectedGame, isPaused, isInstalling, clearInstallationProgress]);

  const getInstallButtonText = useCallback((): string => {
    if (!isOnline) return '❌ Немає інтернету';
    if (isPlanned) return 'Заплановано';
    if (isPaused) {
      return 'Призупинено';
    }
    if (isInstalling) {
      return isUpdateAvailable ? 'Оновлення...' : 'Встановлення...';
    }
    if (isUpdateAvailable && !isCheckingInstallation) {
      return `Оновити до v${selectedGame?.version}`;
    }
    if (installationInfo) {
      return `Перевстановити (v${installationInfo.version})`;
    }
    return 'Встановити українізатор';
  }, [
    isOnline,
    isPlanned,
    isPaused,
    isInstalling,
    isUpdateAvailable,
    isCheckingInstallation,
    selectedGame?.version,
    installationInfo,
  ]);

  return {
    isInstalling,
    isUninstalling,
    isPaused,
    installProgress,
    downloadProgress,
    statusMessage,
    handleInstall,
    handleInstallOptionsConfirm,
    handleUninstall,
    handlePauseDownload,
    handleResumeDownload,
    handleCancelDownload,
    getInstallButtonText,
    showInstallOptions,
    setShowInstallOptions,
    pendingInstallPath,
  };
}
