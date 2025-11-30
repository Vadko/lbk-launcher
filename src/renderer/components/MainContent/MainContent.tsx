import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, Heart, Gamepad2 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useModalStore } from '../../store/useModalStore';
import { useConfirmStore } from '../../store/useConfirmStore';
import { GameHero } from './GameHero';
import { StatusCard } from './StatusCard';
import { InfoCard } from './InfoCard';
import { VideoCard } from './VideoCard';
import { Button } from '../ui/Button';
import type { InstallationInfo, InstallResult } from '../../../shared/types';

export const MainContent: React.FC = () => {
  const { selectedGame } = useStore();
  const { showModal } = useModalStore();
  const { showConfirm } = useConfirmStore();
  const [isInstalling, setIsInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState(0);
  const [installationInfo, setInstallationInfo] = useState<InstallationInfo | null>(null);
  const [isCheckingInstallation, setIsCheckingInstallation] = useState(false);

  // Check installation status when game changes
  useEffect(() => {
    const checkInstallationStatus = async () => {
      if (!selectedGame || !window.electronAPI) {
        setInstallationInfo(null);
        return;
      }

      setIsCheckingInstallation(true);
      try {
        const info = await window.electronAPI.checkInstallation(selectedGame.id);
        setInstallationInfo(info);
      } catch (error) {
        console.error('Error checking installation:', error);
        setInstallationInfo(null);
      } finally {
        setIsCheckingInstallation(false);
      }
    };

    checkInstallationStatus();
  }, [selectedGame]);

  const isUpdateAvailable =
    installationInfo && selectedGame && selectedGame.version && installationInfo.version !== selectedGame.version;

  const isPlanned = selectedGame?.status === 'planned';

  const handleInstall = async (customGamePath?: string) => {
    if (!selectedGame || isInstalling || isCheckingInstallation) return;

    // Check if Electron API is available
    if (!window.electronAPI) {
      showModal({
        title: 'Недоступно',
        message: 'Встановлення доступне тільки в десктопній версії додатку',
        type: 'error',
      });
      return;
    }

    // Check if installer file is present
    const hasInstaller =
      (process.platform === 'win32' && selectedGame.installation_file_windows_path) ||
      (process.platform === 'linux' && selectedGame.installation_file_linux_path);

    // Show warning if installer is present
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

    // No installer - proceed directly
    await performInstallation(customGamePath);
  };

  const performInstallation = async (customGamePath?: string) => {
    if (!selectedGame) return;

    try {
      setIsInstalling(true);
      setInstallProgress(0);

      // Setup progress listener
      window.electronAPI.onInstallProgress?.((progress: number) => {
        setInstallProgress(progress);
      });

      // Get the first available platform
      const platform = selectedGame.platforms[0] || 'steam';

      // Start installation
      const result: InstallResult = await window.electronAPI.installTranslation(
        selectedGame.id,
        platform,
        customGamePath
      );

      // Check if installation failed
      if (!result.success && result.error) {
        // Check if this is a "game not found" error that needs manual folder selection
        if (result.error.needsManualSelection) {
          showConfirm({
            title: 'Гру не знайдено',
            message: `${result.error.message}\n\nБажаєте вибрати папку з грою вручну?`,
            confirmText: 'Вибрати папку',
            cancelText: 'Скасувати',
            onConfirm: async () => {
              const selectedFolder = await window.electronAPI.selectGameFolder();
              if (selectedFolder) {
                // Retry installation with custom path
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

      // Refresh installation info
      const newInfo = await window.electronAPI.checkInstallation(selectedGame.id);
      setInstallationInfo(newInfo);

      const message = isUpdateAvailable
        ? `Переклад ${selectedGame.name} успішно оновлено до версії ${selectedGame.version}!`
        : `Переклад ${selectedGame.name} успішно встановлено!`;

      showModal({
        title: isUpdateAvailable ? 'Переклад оновлено' : 'Переклад встановлено',
        message,
        type: 'success',
      });
      setInstallProgress(100);
    } catch (error) {
      console.error('Installation error:', error);
      showModal({
        title: 'Помилка встановлення',
        message: error instanceof Error ? error.message : 'Невідома помилка',
        type: 'error',
      });
    } finally {
      setIsInstalling(false);
      setInstallProgress(0);
    }
  };

  const handleSupport = () => {
    if (!selectedGame) return;

    // Use game-specific support URL or fallback to default
    const supportUrl = selectedGame.support_url || 'https://github.com/LittleBitUA';

    if (window.electronAPI) {
      window.electronAPI.openExternal(supportUrl);
    } else {
      window.open(supportUrl, '_blank');
    }
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
    <div className="flex-1 overflow-y-auto px-8 py-6">
      <GameHero game={selectedGame} />

      <div className="glass-card mb-6">
        <div className="flex gap-4">
          <Button
            variant="primary"
            icon={isUpdateAvailable ? <RefreshCw size={20} /> : <Download size={20} />}
            onClick={() => handleInstall()}
            disabled={isInstalling || isPlanned}
          >
            {isPlanned
              ? 'Заплановано'
              : isInstalling
                ? isUpdateAvailable
                  ? 'Оновлення...'
                  : 'Встановлення...'
                : isUpdateAvailable && !isCheckingInstallation
                  ? `Оновити до v${selectedGame?.version}`
                  : installationInfo
                    ? `Перевстановити (v${installationInfo.version})`
                    : 'Встановити переклад'}
          </Button>
          <Button variant="secondary" icon={<Heart size={20} />} onClick={handleSupport}>
            Підтримати проєкт
          </Button>
        </div>
      </div>

      <div className="space-y-4 mb-6">
        {/* Installation status badge */}
        {installationInfo && !isCheckingInstallation && !isInstalling && (
          <div className="glass-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-2 h-2 rounded-full ${
                    isUpdateAvailable ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'
                  }`}
                />
                <div>
                  <div className="text-sm font-medium text-white">
                    {isUpdateAvailable
                      ? '⚡ Доступне оновлення'
                      : '✓ Переклад встановлено'}
                  </div>
                  <div className="text-xs text-text-muted mt-0.5">
                    {isUpdateAvailable ? (
                      <>
                        Встановлена версія: v{installationInfo.version} → Нова версія: v
                        {selectedGame?.version}
                      </>
                    ) : (
                      <>Версія: v{installationInfo.version}</>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {isInstalling && (
          <div className="glass-card">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-white">
                {isUpdateAvailable
                  ? 'Оновлення перекладу...'
                  : 'Встановлення перекладу...'}
              </span>
              <span className="text-sm font-bold text-neon-blue">
                {Math.round(installProgress)}%
              </span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300 ease-out bg-gradient-to-r from-neon-blue to-neon-purple"
                style={{
                  width: `${installProgress}%`,
                  boxShadow: '0 0 10px rgba(0, 242, 255, 0.5)',
                }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <StatusCard game={selectedGame} />
        <InfoCard game={selectedGame} />
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
