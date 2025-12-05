import React, { useEffect, useState, useCallback } from 'react';
import { Download, RefreshCw, Heart, Gamepad2, Trash2, Play } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useModalStore } from '../../store/useModalStore';
import { useConfirmStore } from '../../store/useConfirmStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { GameHero } from './GameHero';
import { StatusCard } from './StatusCard';
import { InfoCard } from './InfoCard';
import { VideoCard } from './VideoCard';
import { SocialLinksCard } from './SocialLinksCard';
import { InstallationStatusBadge } from './InstallationStatusBadge';
import { DownloadProgressCard } from './DownloadProgressCard';
import { InstallationStatusMessage } from './InstallationStatusMessage';
import { Button } from '../ui/Button';
import type { InstallResult, DownloadProgress, LaunchGameResult } from '../../../shared/types';

export const MainContent: React.FC = () => {
  const {
    selectedGame,
    getInstallationProgress,
    setInstallationProgress,
    clearInstallationProgress,
    checkInstallationStatus,
    getInstallationInfo,
    isCheckingInstallationStatus,
    isGameDetected,
  } = useStore();
  const { showModal } = useModalStore();
  const { showConfirm } = useConfirmStore();
  const { createBackupBeforeInstall } = useSettingsStore();
  const [isLaunching, setIsLaunching] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const gameProgress = selectedGame ? getInstallationProgress(selectedGame.id) : undefined;
  const isInstalling = gameProgress?.isInstalling || false;
  const isUninstalling = gameProgress?.isUninstalling || false;
  const installProgress = gameProgress?.progress || 0;
  const downloadProgress = gameProgress?.downloadProgress || null;
  const statusMessage = gameProgress?.statusMessage || null;
  const installationInfo = selectedGame ? getInstallationInfo(selectedGame.id) : undefined;
  const isCheckingInstallation = selectedGame ? isCheckingInstallationStatus(selectedGame.id) : false;

  const isGameInstalledOnSystem = selectedGame ? isGameDetected(selectedGame.id) : false;
  const isTranslationInstalled = installationInfo && installationInfo.gameId === selectedGame?.id;
  const isUpdateAvailable =
    installationInfo && selectedGame && selectedGame.version && installationInfo.version !== selectedGame.version;
  const isPlanned = selectedGame?.status === 'planned';

  // Check installation status when game changes
  useEffect(() => {
    if (selectedGame) {
      checkInstallationStatus(selectedGame.id, selectedGame);
    }
  }, [selectedGame, checkInstallationStatus]);

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log('[MainContent] Internet connection restored');

      if (selectedGame && isInstalling) {
        setInstallationProgress(selectedGame.id, {
          statusMessage: 'Підключення відновлено. Спроба продовжити...',
        });
      }
    };

    const handleOffline = async () => {
      setIsOnline(false);
      console.log('[MainContent] Internet connection lost');

      if (selectedGame && isInstalling) {
        console.log('[MainContent] Aborting download due to connection loss');
        await window.electronAPI?.abortDownload();
        setInstallationProgress(selectedGame.id, {
          statusMessage: '❌ Завантаження скасовано через відсутність підключення до Інтернету',
        });
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [selectedGame, isInstalling, setInstallationProgress]);

  const performInstallation = useCallback(async (customGamePath?: string) => {
    if (!selectedGame) return;

    const platform = selectedGame.platforms[0] || 'steam';

    // For emulator, always require manual folder selection
    if (platform === 'emulator' && !customGamePath) {
      showConfirm({
        title: 'Виберіть папку з грою',
        message: 'Для емуляторів потрібно вручну вказати папку з грою.\n\nВиберіть папку з грою?',
        confirmText: 'Вибрати папку',
        cancelText: 'Скасувати',
        onConfirm: async () => {
          const selectedFolder = await window.electronAPI.selectGameFolder();
          if (selectedFolder) {
            await performInstallation(selectedFolder);
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
        customGamePath,
        createBackupBeforeInstall
      );

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
                await performInstallation(selectedFolder);
              }
            },
          });
        } else {
          showModal({
            title: 'Помилка встановлення',
            message: result.error.message,
            type: 'error',
          });
        }
        return;
      }

      checkInstallationStatus(selectedGame.id, selectedGame);
      useStore.getState().clearGameUpdate(selectedGame.id);

      const message = isUpdateAvailable
        ? `Переклад ${selectedGame.name} успішно оновлено до версії ${selectedGame.version}!`
        : `Переклад ${selectedGame.name} успішно встановлено!`;

      showModal({
        title: isUpdateAvailable ? 'Переклад оновлено' : 'Переклад встановлено',
        message,
        type: 'success',
      });
    } catch (error) {
      console.error('Installation error:', error);
      showModal({
        title: 'Помилка встановлення',
        message: error instanceof Error ? error.message : 'Невідома помилка',
        type: 'error',
      });
    } finally {
      clearInstallationProgress(selectedGame.id);
    }
  }, [selectedGame, isUpdateAvailable, createBackupBeforeInstall, setInstallationProgress, checkInstallationStatus, clearInstallationProgress, showModal, showConfirm]);

  const handleInstall = useCallback(async (customGamePath?: string) => {
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
        message: 'Встановлення доступне тільки в десктопній версії додатку',
        type: 'error',
      });
      return;
    }

    const hasInstaller =
      selectedGame.installation_file_windows_path ||
      selectedGame.installation_file_linux_path;

    if (hasInstaller) {
      showConfirm({
        title: 'Запуск інсталятора',
        message: 'Після завантаження та розпакування перекладу буде запущено інсталятор.\n\nПродовжити встановлення?',
        confirmText: 'Продовжити',
        cancelText: 'Скасувати',
        onConfirm: async () => {
          await performInstallation(customGamePath);
        },
      });
      return;
    }

    await performInstallation(customGamePath);
  }, [selectedGame, isInstalling, isCheckingInstallation, isOnline, performInstallation, showModal, showConfirm]);

  const handleSupport = useCallback(() => {
    if (!selectedGame) return;

    const supportUrl = selectedGame.support_url || 'https://github.com/LittleBitUA';

    if (window.electronAPI) {
      window.electronAPI.openExternal(supportUrl);
    } else {
      window.open(supportUrl, '_blank');
    }
  }, [selectedGame]);

  const handleLaunchGame = useCallback(async () => {
    if (!selectedGame || isLaunching || !isGameInstalledOnSystem || !isTranslationInstalled) return;

    setIsLaunching(true);
    try {
      console.log(`[UI] Launching game: ${selectedGame.name} (${selectedGame.id})`);
      const result: LaunchGameResult = await window.electronAPI.launchGame(selectedGame);

      if (!result.success && result.error) {
        showModal({
          title: 'Помилка запуску',
          message: result.error,
          type: 'error',
        });
      }
    } catch (error) {
      console.error('Launch game error:', error);
      showModal({
        title: 'Помилка запуску',
        message: error instanceof Error ? error.message : 'Не вдалося запустити гру',
        type: 'error',
      });
    } finally {
      setIsLaunching(false);
    }
  }, [selectedGame, isLaunching, isGameInstalledOnSystem, isTranslationInstalled, showModal]);

  const handleUninstall = useCallback(async () => {
    if (!selectedGame || !installationInfo) return;

    const hasBackup = installationInfo.hasBackup !== false;
    const backupWarning = !hasBackup
      ? '\n\n⚠️ УВАГА: Резервну копію не було створено при встановленні. Оригінальні файли НЕ будуть відновлені!'
      : '\n\nОригінальні файли гри будуть відновлені з резервної копії.';

    showConfirm({
      title: 'Видалення перекладу',
      message: `Ви впевнені, що хочете видалити переклад для "${selectedGame.name}"?${backupWarning}`,
      confirmText: 'Видалити',
      cancelText: 'Скасувати',
      onConfirm: async () => {
        try {
          setInstallationProgress(selectedGame.id, {
            isUninstalling: true,
          });

          const result: InstallResult = await window.electronAPI.uninstallTranslation(selectedGame);

          if (!result.success && result.error) {
            showModal({
              title: 'Помилка видалення',
              message: result.error.message,
              type: 'error',
            });
            return;
          }

          checkInstallationStatus(selectedGame.id, selectedGame);

          showModal({
            title: 'Переклад видалено',
            message: `Переклад "${selectedGame.name}" успішно видалено!`,
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
  }, [selectedGame, installationInfo, setInstallationProgress, checkInstallationStatus, clearInstallationProgress, showModal, showConfirm]);

  const getInstallButtonText = (): string => {
    if (!isOnline) return '❌ Немає інтернету';
    if (isPlanned) return 'Заплановано';
    if (isInstalling) {
      return isUpdateAvailable ? 'Оновлення...' : 'Встановлення...';
    }
    if (isUpdateAvailable && !isCheckingInstallation) {
      return `Оновити до v${selectedGame?.version}`;
    }
    if (installationInfo) {
      return `Перевстановити (v${installationInfo.version})`;
    }
    return 'Встановити переклад';
  };

  if (!selectedGame) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
        <Gamepad2 size={64} className="text-text-muted mb-4 opacity-50" />
        <h2 className="text-2xl font-head font-semibold text-white mb-2">
          Оберіть гру зі списку
        </h2>
        <p className="text-text-muted max-w-md">
          Виберіть гру, щоб побачити деталі та встановити переклад
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar">
      <GameHero game={selectedGame} />

      <div className="glass-card mb-6">
        <div className="flex gap-4">
          {selectedGame && isGameInstalledOnSystem && isTranslationInstalled && (
            <Button
              variant="green"
              icon={<Play size={20} />}
              onClick={handleLaunchGame}
              disabled={isLaunching || isInstalling || isUninstalling}
            >
              {isLaunching ? 'Запуск...' : 'Грати'}
            </Button>
          )}
          <Button
            variant={isGameInstalledOnSystem && isTranslationInstalled ? "secondary" : "primary"}
            icon={isUpdateAvailable ? <RefreshCw size={20} /> : <Download size={20} />}
            onClick={() => handleInstall()}
            disabled={isInstalling || isUninstalling || isPlanned || !isOnline}
            title={!isOnline ? 'Відсутнє підключення до Інтернету' : undefined}
          >
            {getInstallButtonText()}
          </Button>
          {installationInfo && !isInstalling && !isUpdateAvailable && installationInfo.hasBackup !== false && (
            <Button
              variant="secondary"
              icon={<Trash2 size={20} />}
              onClick={handleUninstall}
              disabled={isUninstalling}
            >
              {isUninstalling ? 'Видалення...' : 'Видалити переклад'}
            </Button>
          )}
          <Button variant="secondary" icon={<Heart size={20} />} onClick={handleSupport}>
            Підтримати проєкт
          </Button>
        </div>
      </div>

      <div className="space-y-4 mb-6">
        {installationInfo && !isCheckingInstallation && !isInstalling && (
          <InstallationStatusBadge
            isUpdateAvailable={!!isUpdateAvailable}
            installedVersion={installationInfo.version}
            newVersion={selectedGame?.version}
          />
        )}

        {isInstalling && (
          <div className="glass-card">
            {downloadProgress && downloadProgress.totalBytes > 0 ? (
              <DownloadProgressCard progress={installProgress} downloadProgress={downloadProgress} />
            ) : (
              <InstallationStatusMessage
                statusMessage={statusMessage}
                isUpdateAvailable={!!isUpdateAvailable}
                isOnline={isOnline}
                isInstalling={isInstalling}
              />
            )}
          </div>
        )}

        {isUninstalling && (
          <div className="glass-card">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium text-white">
                Видалення перекладу та відновлення оригінальних файлів...
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <StatusCard game={selectedGame} />
        <InfoCard game={selectedGame} />
      </div>

      <div className="mb-6">
        <SocialLinksCard game={selectedGame} />
      </div>

      {selectedGame.video_url && (
        <div className="mb-6">
          <VideoCard videoUrl={selectedGame.video_url} />
        </div>
      )}

      <div className="glass-card mb-6">
        <h3 className="text-lg font-head font-semibold text-white mb-3">Про переклад</h3>
        <p className="text-text-muted leading-relaxed whitespace-pre-line">
          {selectedGame.description}
        </p>
      </div>

      {selectedGame.game_description && (
        <div className="glass-card mb-6">
          <h3 className="text-lg font-head font-semibold text-white mb-3">Про гру</h3>
          <p className="text-text-muted leading-relaxed whitespace-pre-line">
            {selectedGame.game_description}
          </p>
        </div>
      )}
    </div>
  );
};
