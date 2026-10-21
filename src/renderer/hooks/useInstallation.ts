import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '@/shared/i18n/i18n';
import type {
  ConflictingTranslation,
  DownloadProgress,
  Game,
  GamePath,
  InstallationInfo,
  InstallationStatusTone,
  InstallOptions,
  InstallResult,
  Platform,
} from '../../shared/types';
import { useConfirmStore } from '../store/useConfirmStore';
import { useModalStore } from '../store/useModalStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useSteamBridgeStatusStore } from '../store/useSteamBridgeStatusStore';
import { useStore } from '../store/useStore';
import { useSubscriptionsStore } from '../store/useSubscriptionsStore';
import { trackEvent } from '../utils/analytics';
import { isTranslationInstallable } from '../utils/gameStatus';
import {
  type InstallSuccessInput,
  installSuccessActions,
  installSuccessMessage,
  needsBridgeStatus,
  restartSteamAfterInstall,
} from '../utils/installSuccess';
import { openOfferTarget } from '../utils/openOfferTarget';
import { type ActionPhase, useActionPhase } from './useActionPhase';
import { useIsWorkshopChangePending } from './useInstalledTranslations';

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
  isWorkshopChangePending: boolean;
  isPaused: boolean;
  isWaitingForNetwork: boolean;
  installProgress: number;
  downloadProgress: DownloadProgress | null;
  statusMessage: string | null;
  statusTone: InstallationStatusTone | null;
  handleInstall: (customGamePath?: string) => Promise<void>;
  handleInstallOptionsConfirm: (
    installOptions: InstallOptions,
    removeOptions: { removeVoice: boolean; removeAchievements: boolean }
  ) => Promise<void>;
  handleUninstall: () => Promise<void>;
  handleRerunInstaller: () => Promise<void>;
  handlePauseDownload: () => Promise<void>;
  handleResumeDownload: () => Promise<void>;
  handleCancelDownload: () => Promise<void>;
  getInstallButtonText: () => string;
  installPhase: ActionPhase;
  rerunPhase: ActionPhase;
  showInstallOptions: boolean;
  closeInstallOptions: () => void;
  pendingInstallPath: string | undefined;
  availablePlatforms: GamePath[];
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
  const protonSelectionRef = useRef<string | undefined>(undefined);
  const [availablePlatforms, setAvailablePlatforms] = useState<GamePath[]>([]);
  const {
    phase: installPhase,
    isPending: isInstallPrecheckPending,
    run: runInstallPrecheck,
    reset: resetInstallPrecheck,
  } = useActionPhase();
  const {
    phase: rerunPhase,
    isPending: isRerunPending,
    run: runRerunInstaller,
    reset: resetRerun,
  } = useActionPhase();
  const installFlowRef = useRef(false);

  const closeInstallOptions = useCallback(() => {
    setShowInstallOptions(false);
    resetInstallPrecheck();
  }, [resetInstallPrecheck]);

  useEffect(() => {
    installFlowRef.current = false;
    resetInstallPrecheck();
    resetRerun();
  }, [selectedGame?.id, resetInstallPrecheck, resetRerun]);

  const isWorkshopChangePending = useIsWorkshopChangePending(selectedGame?.id);

  const gameProgress = selectedGame
    ? getInstallationProgress(selectedGame.id)
    : undefined;
  const isInstalling = gameProgress?.isInstalling || false;
  const isUninstalling = gameProgress?.isUninstalling || false;
  const isPaused = gameProgress?.isPaused || false;
  const isWaitingForNetwork = gameProgress?.isWaitingForNetwork || false;
  const installProgress = gameProgress?.progress || 0;
  const downloadProgress = gameProgress?.downloadProgress || null;
  const statusMessage = gameProgress?.statusMessage || null;
  const statusTone = gameProgress?.statusTone || null;

  const isPlanned = selectedGame?.status === 'planned';
  const isTechImprovement = selectedGame?.status === 'tech-improvement';

  // Retry context for auto-retry when network is restored
  const networkRetryRef = useRef<{
    customGamePath?: string;
    options: InstallOptions;
    autoRetried: boolean;
  } | null>(null);

  const performInstallation = useCallback(
    (customGamePath?: string, options?: InstallOptions) => {
      async function run(
        customGamePath?: string,
        options?: InstallOptions
      ): Promise<void> {
        if (!selectedGame) {
          return;
        }

        const platform =
          options?.platform || (selectedGame.platforms[0] as Platform) || 'steam';
        const effectiveOptions: InstallOptions = options ??
          pendingInstallOptions ?? {
            createBackup: createBackupBeforeInstall,
            installText: true,
            installVoice: false,
            installAchievements: false,
            platform,
          };

        if (options) {
          setPendingInstallOptions(options);
        }

        // For emulator, always require manual folder selection
        if (platform === 'emulator' && !customGamePath) {
          showConfirm({
            title: t('installEmulator.title'),
            message: t('installEmulator.message'),
            confirmText: t('common.selectFolder'),
            cancelText: t('common.cancel'),
            onConfirm: async () => {
              const selectedFolder = await window.electronAPI.selectGameFolder();
              if (selectedFolder) {
                void run(selectedFolder, effectiveOptions);
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

          // Track download start event
          trackEvent('Actions', {
            'Game Id': selectedGame.id,
            'Game Name': selectedGame.name,
            'Install Text': effectiveOptions.installText,
            'Install Voice': effectiveOptions.installVoice,
            'Install Achievements': effectiveOptions.installAchievements,
            Team: selectedGame.team || 'Unknown',
            Type: 'install',
          });

          const result: InstallResult = await window.electronAPI.installTranslation(
            selectedGame,
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
                title: t('installGameNotFound.title'),
                message: t('installGameNotFound.message', {
                  error: result.error.message,
                }),
                confirmText: t('common.selectFolder'),
                cancelText: t('common.cancel'),
                onConfirm: async () => {
                  const selectedFolder = await window.electronAPI.selectGameFolder();
                  if (selectedFolder) {
                    void run(selectedFolder, effectiveOptions);
                  }
                },
              });
            } else if (result.error.isRateLimit) {
              showModal({
                title: t('install.rateLimitTitle'),
                message: result.error.message,
                type: 'info',
              });
            } else if (result.error.isNetworkError) {
              // Check if this was already an auto-retry — show modal for manual retry
              if (networkRetryRef.current?.autoRetried) {
                networkRetryRef.current = null;
                showModal({
                  title: t('installNetwork.interruptedTitle'),
                  message: t('installNetwork.interruptedMessage'),
                  type: 'error',
                  actions: [
                    {
                      label: t('installNetwork.retry'),
                      onClick: () => {
                        void run(customGamePath, effectiveOptions);
                      },
                      variant: 'primary',
                    },
                  ],
                });
                clearInstallationProgress(selectedGame.id);
              } else {
                // First network failure — wait for reconnection and auto-retry
                networkRetryRef.current = {
                  customGamePath,
                  options: effectiveOptions,
                  autoRetried: false,
                };
                setInstallationProgress(selectedGame.id, {
                  isInstalling: true,
                  isWaitingForNetwork: true,
                  downloadProgress: null,
                  statusMessage: t('installNetwork.waiting'),
                  statusTone: 'waiting',
                });
              }
              return;
            } else {
              showModal({
                title: t('common.installError'),
                message: result.error.message,
                type: 'error',
              });
            }
            clearInstallationProgress(selectedGame.id);
            return;
          }

          // Clear network retry context on success
          networkRetryRef.current = null;

          setPendingInstallOptions(undefined);
          useStore.getState().clearGameUpdate(selectedGame.id);
          // Now that this version is installed, re-arm notifications for future updates
          useSubscriptionsStore.getState().clearNotifiedVersion(selectedGame.id);

          // Track installation event
          if (isUpdateAvailable) {
            trackEvent('Actions', {
              'Game Id': selectedGame.id,
              'Game Name': selectedGame.name,
              Team: selectedGame.team || 'Unknown',
              'Install Text': effectiveOptions.installText,
              'Install Voice': effectiveOptions.installVoice,
              'Install Achievements': effectiveOptions.installAchievements,
              Type: 'updated',
            });
          } else {
            trackEvent('Actions', {
              'Game Id': selectedGame.id,
              'Game Name': selectedGame.name,
              Team: selectedGame.team || 'Unknown',
              'Install Text': effectiveOptions.installText,
              'Install Voice': effectiveOptions.installVoice,
              'Install Achievements': effectiveOptions.installAchievements,
              Type: 'installed',
            });
          }

          const launchOptionsQueued = result.launchOptionsQueued === true;
          const delivery = effectiveOptions.installAchievements
            ? result.achievementsDelivery
            : undefined;
          const settings = useSettingsStore.getState();
          const successInput: InstallSuccessInput = {
            launchOptionsQueued,
            launchOptionsError: result.launchOptionsError,
            delivery,
            status: needsBridgeStatus({ delivery, launchOptionsQueued })
              ? await useSteamBridgeStatusStore.getState().refresh()
              : null,
            declined: {
              millennium: settings.millenniumOfferDeclined,
              decky: settings.deckyPluginOfferDeclined,
            },
          };
          const message = installSuccessMessage(
            isUpdateAvailable
              ? t('installSuccess.updatedMessage', {
                  name: selectedGame.name,
                  version: String(selectedGame.version),
                })
              : t('installSuccess.installedMessage', { name: selectedGame.name }),
            successInput
          );
          const actions = installSuccessActions(successInput, {
            restart: () => restartSteamAfterInstall(selectedGame, launchOptionsQueued),
            open: (target) => openOfferTarget(target, 'offer'),
          });

          showModal({
            title: isUpdateAvailable
              ? t('installSuccess.updatedTitle')
              : t('installSuccess.installedTitle'),
            message,
            type: 'success',
            actions,
          });

          // Trigger callback for first install (not update)
          if (!isUpdateAvailable && onFirstInstallComplete) {
            onFirstInstallComplete();
          }

          clearInstallationProgress(selectedGame.id);
          // Re-reconcile version state now the in-progress guard is cleared: catches a
          // newer version that was published mid-install (and thus skipped by the guard),
          // independent of installed-games-changed watcher timing.
          void useStore.getState().loadInstalledGamesFromSystem();
        } catch (error) {
          console.error('Installation error:', error);
          showModal({
            title: t('common.installError'),
            message: error instanceof Error ? error.message : t('common.unknownError'),
            type: 'error',
          });
          clearInstallationProgress(selectedGame.id);
        }
      }

      return run(customGamePath, options);
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

  // Auto-retry download when network is restored (or immediately if still online)
  useEffect(() => {
    if (!isOnline || !isWaitingForNetwork || !networkRetryRef.current || !selectedGame) {
      return;
    }

    const retryContext = networkRetryRef.current;
    retryContext.autoRetried = true;

    // Small delay to let the network stabilize
    const timer = setTimeout(() => {
      console.log('[useInstallation] Auto-retrying download for:', selectedGame.id);
      setInstallationProgress(selectedGame.id, {
        isWaitingForNetwork: false,
        statusMessage: t('installNetwork.resuming'),
      });
      performInstallation(retryContext.customGamePath, retryContext.options);
    }, 2000);

    return () => clearTimeout(timer);
  }, [
    isOnline,
    isWaitingForNetwork,
    selectedGame,
    performInstallation,
    setInstallationProgress,
  ]);

  // Listen for the main process asking whether to launch the freshly extracted
  // installer/script now. It blocks the install promise until we respond.
  useEffect(() => {
    if (!window.electronAPI?.onRequestRunInstallerConfirm) {
      return;
    }

    const unsubscribe = window.electronAPI.onRequestRunInstallerConfirm(
      ({ gameId, installerPath, isExe, protons }) => {
        const message = protons
          ? isExe
            ? t('runInstaller.exeProtonMessage')
            : t('runInstaller.scriptProtonMessage')
          : isExe
            ? t('runInstaller.exeAskMessage')
            : t('runInstaller.scriptAskMessage');

        // «Ні» keeps protonPath too — «Перевстановити» and uninstall reuse it.
        const show = (protonPath?: string) => {
          showModal({
            title: isExe ? t('runInstaller.exeTitle') : t('runInstaller.scriptTitle'),
            message,
            type: 'info',
            mandatory: true,
            selectConfig: protons
              ? {
                  options: protons.map((p) => ({ name: p.name, value: p.path })),
                  selectedValue: protonPath,
                  onSelectionChange: (value) => {
                    protonSelectionRef.current = value;
                    show(value);
                  },
                  placeholder: t('runInstaller.protonPlaceholder'),
                }
              : undefined,
            actions: [
              {
                label: t('runInstaller.openFolder'),
                onClick: () => window.electronAPI.showItemInFolder(installerPath),
                variant: 'secondary',
                keepOpen: true,
              },
              {
                label: t('runInstaller.run'),
                onClick: () =>
                  window.electronAPI.respondRunInstaller(gameId, {
                    run: true,
                    protonPath,
                  }),
                variant: 'primary',
              },
              {
                label: t('runInstaller.skip'),
                onClick: () =>
                  window.electronAPI.respondRunInstaller(gameId, {
                    run: false,
                    protonPath,
                  }),
                variant: 'secondary',
              },
            ],
          });
        };

        show(
          protons?.find((p) => p.path === protonSelectionRef.current)?.path ??
            protons?.[0]?.path
        );
      }
    );

    return unsubscribe;
  }, [showModal]);

  const handleConflictingTranslation = useCallback(
    async (conflict: ConflictingTranslation): Promise<boolean> =>
      new Promise((resolve) => {
        const teamInfo = conflict.team ? ` (${conflict.team})` : '';
        showConfirm({
          title: t('installConflict.title'),
          message: t('installConflict.message', {
            name: conflict.gameName,
            team: teamInfo,
            version: conflict.version,
          }),
          confirmText: t('installConflict.confirm'),
          cancelText: t('common.cancel'),
          onConfirm: async () => {
            try {
              // Get conflicting game info
              const [conflictingGame] = await window.electronAPI.fetchGamesByIds([
                conflict.gameId,
              ]);

              if (!conflictingGame) {
                showModal({
                  title: t('common.error'),
                  message: t('installConflict.infoNotFound'),
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
                  title: t('common.uninstallError'),
                  message: result.error?.message || t('installConflict.removeFailed'),
                  type: 'error',
                });
                resolve(false);
                return;
              }

              // Track removal of conflicting translation
              trackEvent('Actions', {
                'Game Id': conflict.gameId,
                'Game Name': conflict.gameName,
                Team: conflict.team || 'Unknown',
                Type: 'delete',
              });

              // Refresh installed translations cache
              await useStore.getState().loadInstalledGamesFromSystem();

              resolve(true);
            } catch (error) {
              console.error('Error removing conflicting translation:', error);
              showModal({
                title: t('common.error'),
                message:
                  error instanceof Error
                    ? error.message
                    : t('installConflict.removeFailed'),
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
      if (
        !selectedGame ||
        isInstalling ||
        isCheckingInstallation ||
        isInstallPrecheckPending ||
        installFlowRef.current
      ) {
        return;
      }

      if (!isTranslationInstallable(selectedGame.status)) {
        return;
      }

      if (!isOnline) {
        showModal({
          title: t('installNetwork.offlineTitle'),
          message: t('installNetwork.offlineMessage'),
          type: 'error',
        });
        return;
      }

      if (!window.electronAPI) {
        showModal({
          title: t('installUnavailable.title'),
          message: t('installUnavailable.message'),
          type: 'error',
        });
        return;
      }

      installFlowRef.current = true;
      try {
        const conflict = await runInstallPrecheck(
          () => window.electronAPI.getConflictingTranslation(selectedGame),
          { holdPending: true }
        );
        if (conflict) {
          resetInstallPrecheck();
          if (!(await handleConflictingTranslation(conflict))) {
            return;
          }
        }
        await runInstallPrecheck(
          async () =>
            setAvailablePlatforms(
              await window.electronAPI.detectGamePlatforms(selectedGame)
            ),
          { holdPending: true }
        );
        setPendingInstallPath(customGamePath);
        setShowInstallOptions(true);
      } catch (error) {
        console.error('[useInstallation] Install pre-check failed:', error);
      } finally {
        installFlowRef.current = false;
      }
    },
    [
      selectedGame,
      isInstalling,
      isCheckingInstallation,
      isOnline,
      showModal,
      handleConflictingTranslation,
      isInstallPrecheckPending,
      runInstallPrecheck,
      resetInstallPrecheck,
    ]
  );

  const handleInstallOptionsConfirm = useCallback(
    async (
      installOptions: InstallOptions,
      removeOptions: { removeVoice: boolean; removeAchievements: boolean }
    ) => {
      if (!selectedGame) {
        return;
      }

      // First, remove components if requested
      if (removeOptions.removeVoice || removeOptions.removeAchievements) {
        try {
          setInstallationProgress(selectedGame.id, {
            isInstalling: true,
            statusMessage: t('installComponents.removing'),
          });

          const result = await window.electronAPI.removeComponents(selectedGame, {
            voice: removeOptions.removeVoice,
            achievements: removeOptions.removeAchievements,
          });

          if (!result.success) {
            showModal({
              title: t('common.uninstallError'),
              message: result.error?.message || t('installComponents.removeFailed'),
              type: 'error',
            });
            clearInstallationProgress(selectedGame.id);
            return;
          }

          await checkInstallationStatus(selectedGame.id, selectedGame);
        } catch (error) {
          console.error('Error removing components:', error);
          showModal({
            title: t('common.uninstallError'),
            message: error instanceof Error ? error.message : t('common.unknownError'),
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
          title: t('installComponents.removedTitle'),
          message: t('installComponents.removedMessage'),
          type: 'success',
        });
        return;
      }

      // Proceed with installation if needed
      const hasInstaller =
        selectedGame.installation_file_windows_path ||
        selectedGame.installation_file_linux_path;

      if (hasInstaller) {
        // Which file runs (and whether via Proton) is known only after extraction.
        showConfirm({
          title: t('runInstaller.exeTitle'),
          message: t('runInstaller.confirmMessage'),
          confirmText: t('runInstaller.confirm'),
          cancelText: t('common.cancel'),
          onConfirm: () => {
            void performInstallation(pendingInstallPath, installOptions);
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
    if (!selectedGame || !installationInfo) {
      return;
    }

    const hasBackup = installationInfo.hasBackup !== false;
    const backupWarning = !hasBackup
      ? t('uninstall.noBackupWarning')
      : t('uninstall.backupWarning');

    showConfirm({
      title: t('uninstall.title'),
      message: t('uninstall.message', { name: selectedGame.name, backupWarning }),
      confirmText: t('uninstall.confirm'),
      cancelText: t('common.cancel'),
      onConfirm: async () => {
        try {
          setInstallationProgress(selectedGame.id, {
            isUninstalling: true,
          });

          const result: InstallResult =
            await window.electronAPI.uninstallTranslation(selectedGame);

          if (!result.success && result.error) {
            showModal({
              title: t('common.uninstallError'),
              message: result.error.message,
              type: 'error',
            });
            return;
          }

          // Track uninstallation event
          trackEvent('Actions', {
            'Game Id': selectedGame.id,
            'Game Name': selectedGame.name,
            Team: selectedGame.team || 'Unknown',
            Type: 'delete',
          });

          // Clear notified version so future installs will get notifications
          useSubscriptionsStore.getState().clearNotifiedVersion(selectedGame.id);

          showModal({
            title: t('uninstall.doneTitle'),
            message: t('uninstall.doneMessage', { name: selectedGame.name }),
            type: 'success',
          });
        } catch (error) {
          console.error('Uninstall error:', error);
          showModal({
            title: t('common.uninstallError'),
            message: error instanceof Error ? error.message : t('common.unknownError'),
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
    if (!selectedGame || !isInstalling || isPaused) {
      return;
    }

    if (!window.electronAPI?.pauseDownload) {
      console.warn('[useInstallation] pauseDownload not available');
      return;
    }

    const result = await window.electronAPI.pauseDownload(selectedGame.id);
    if (result.success) {
      setInstallationProgress(selectedGame.id, {
        isPaused: true,
        statusMessage: t('download.paused'),
      });
    } else {
      showModal({
        title: t('common.error'),
        message: result.error || t('download.pauseFailed'),
        type: 'error',
      });
    }
  }, [selectedGame, isInstalling, isPaused, setInstallationProgress, showModal]);

  const handleResumeDownload = useCallback(async () => {
    if (!selectedGame || !isPaused) {
      return;
    }

    if (!window.electronAPI?.resumeDownload) {
      console.warn('[useInstallation] resumeDownload not available');
      return;
    }

    setInstallationProgress(selectedGame.id, {
      isPaused: false,
      statusMessage: t('download.resuming'),
    });

    const result = await window.electronAPI.resumeDownload(selectedGame.id);

    if (!result.success) {
      showModal({
        title: t('common.error'),
        message: result.error || t('download.resumeFailed'),
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
    if (!selectedGame) {
      return;
    }

    // Clear network retry context
    networkRetryRef.current = null;

    if (isPaused) {
      // Cancel paused download (clears paused state + .part file)
      await window.electronAPI.cancelPausedDownload(selectedGame.id);
    } else if (isInstalling) {
      // Abort active download
      await window.electronAPI.abortDownload();
    }

    clearInstallationProgress(selectedGame.id);
  }, [selectedGame, isPaused, isInstalling, clearInstallationProgress]);

  // The label is phase-independent: the icon and the progress card show how the install is going
  const getInstallButtonText = useCallback((): string => {
    if (!isOnline) {
      return t('installButton.offline');
    }
    if (isPlanned) {
      return t('installButton.planned');
    }
    if (isTechImprovement) {
      return t('installButton.techImprovement');
    }
    if (installationInfo?.hasInstallError && isUpdateAvailable) {
      return t('installButton.reload', { version: String(selectedGame?.version) });
    }
    if (isUpdateAvailable) {
      return t('installButton.update', { version: String(selectedGame?.version) });
    }
    if (installationInfo) {
      return t('installButton.reload', { version: installationInfo.version });
    }
    return t('installButton.install');
  }, [
    isOnline,
    isPlanned,
    isTechImprovement,
    isUpdateAvailable,
    selectedGame?.version,
    installationInfo,
  ]);

  const handleRerunInstaller = useCallback(async () => {
    const installerPath = installationInfo?.installerPath;
    if (!selectedGame || !installerPath) {
      console.warn('[useInstallation] No installer path available');
      return;
    }
    if (isRerunPending) {
      return;
    }

    try {
      const result = await runRerunInstaller(
        () =>
          window.electronAPI.rerunInstaller(installerPath, installationInfo?.protonPath),
        { isSuccess: (r) => r.success }
      );

      if (result.success) {
        showModal({
          title: t('runInstaller.finishedTitle'),
          message: t('runInstaller.finishedMessage'),
          type: 'success',
        });

        await checkInstallationStatus(selectedGame.id, selectedGame);
      } else {
        showModal({
          title: t('common.error'),
          message: result.error?.message || t('runInstaller.failed'),
          type: 'error',
        });
      }
    } catch (error) {
      console.error('[useInstallation] Error re-running installer:', error);
      showModal({
        title: t('common.error'),
        message: t('runInstaller.failed'),
        type: 'error',
      });
    }
  }, [
    selectedGame,
    installationInfo,
    showModal,
    checkInstallationStatus,
    isRerunPending,
    runRerunInstaller,
  ]);

  return {
    isInstalling,
    isUninstalling,
    isWorkshopChangePending,
    isPaused,
    isWaitingForNetwork,
    installProgress,
    downloadProgress,
    statusMessage,
    statusTone,
    handleInstall,
    handleInstallOptionsConfirm,
    handleUninstall,
    handleRerunInstaller,
    handlePauseDownload,
    handleResumeDownload,
    handleCancelDownload,
    getInstallButtonText,
    installPhase,
    rerunPhase,
    showInstallOptions,
    closeInstallOptions,
    pendingInstallPath,
    availablePlatforms,
  };
}
