import React, { useEffect, useState, useCallback } from 'react';
import {
  Download,
  RefreshCw,
  Heart,
  Gamepad2,
  Trash2,
  Play,
  EyeOff,
  Settings,
  Users,
  Star,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useModalStore } from '../../store/useModalStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useSubscriptionsStore } from '../../store/useSubscriptionsStore';
import { useInstallation } from '../../hooks/useInstallation';
import { AuthorSubscriptionModal } from '../Modal/AuthorSubscriptionModal';
import { GameHero } from './GameHero';
import { StatusCard } from './StatusCard';
import { InfoCard } from './InfoCard';
import { VideoCard } from './VideoCard';
import { SocialLinksCard } from './SocialLinksCard';
import { FundraisingProgressCard } from './FundraisingProgressCard';
import { InstallationStatusBadge } from './InstallationStatusBadge';
import { DownloadProgressCard } from './DownloadProgressCard';
import { InstallationStatusMessage } from './InstallationStatusMessage';
import { InstallOptionsDialog } from '../Modal/InstallOptionsDialog';
import { Button } from '../ui/Button';
import { SubscribeButton } from '../ui/SubscribeButton';
import { TeamSubscribeButton } from '../ui/TeamSubscribeButton';
import { Tooltip } from '../ui/Tooltip';
import {
  isSpecialTranslator,
  getSpecialTranslatorInfo,
} from '../../constants/specialTranslators';
import type { LaunchGameResult } from '../../../shared/types';
import { GamesSection } from './GamesSection';

export const MainContent: React.FC = () => {
  const {
    selectedGame,
    checkInstallationStatus,
    isCheckingInstallationStatus,
    isGameDetected,
    installedGames,
    setInstallationProgress,
  } = useStore();
  const { showModal } = useModalStore();
  const { showAdultGames, openSettingsModal, createBackupBeforeInstall } =
    useSettingsStore();
  const { isGamePrompted, markGameAsPrompted } = useSubscriptionsStore();
  const [isLaunching, setIsLaunching] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showAuthorSubscriptionModal, setShowAuthorSubscriptionModal] = useState(false);

  const installationInfo = selectedGame ? installedGames.get(selectedGame.id) : undefined;
  const isCheckingInstallation = selectedGame
    ? isCheckingInstallationStatus(selectedGame.id)
    : false;

  const isGameInstalledOnSystem = selectedGame ? isGameDetected(selectedGame.id) : false;
  const isTranslationInstalled =
    installationInfo && installationInfo.gameId === selectedGame?.id;
  const isUpdateAvailable =
    installationInfo &&
    selectedGame &&
    selectedGame.version &&
    installationInfo.version !== selectedGame.version;
  const isPlanned = selectedGame?.status === 'planned';
  const isAdultBlurred = selectedGame?.is_adult && !showAdultGames;

  // Callback for first install - show subscription modal
  const handleFirstInstallComplete = useCallback(() => {
    if (selectedGame?.team && selectedGame?.id && !isGamePrompted(selectedGame.id)) {
      setShowAuthorSubscriptionModal(true);
    }
  }, [selectedGame?.team, selectedGame?.id, isGamePrompted]);

  const handleCloseAuthorSubscriptionModal = useCallback(() => {
    setShowAuthorSubscriptionModal(false);
    if (selectedGame?.id) {
      markGameAsPrompted(selectedGame.id);
    }
  }, [selectedGame?.id, markGameAsPrompted]);

  // Use installation hook
  const {
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
  } = useInstallation({
    selectedGame,
    isUpdateAvailable: !!isUpdateAvailable,
    installationInfo,
    isOnline,
    isCheckingInstallation,
    onFirstInstallComplete: handleFirstInstallComplete,
  });

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

      // Don't abort if paused - download is already stopped
      if (selectedGame && isInstalling && !isPaused) {
        console.log('[MainContent] Aborting download due to connection loss');
        await window.electronAPI?.abortDownload(
          'Завантаження скасовано через відсутність підключення до Інтернету'
        );
        setInstallationProgress(selectedGame.id, {
          statusMessage:
            '❌ Завантаження скасовано через відсутність підключення до Інтернету',
        });
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [selectedGame, isInstalling, isPaused, setInstallationProgress]);

  const handleSupport = useCallback(() => {
    if (!selectedGame?.support_url) return;

    if (window.electronAPI) {
      window.electronAPI.openExternal(selectedGame.support_url);
    } else {
      window.open(selectedGame.support_url, '_blank');
    }
  }, [selectedGame]);

  const handleLaunchGame = useCallback(async () => {
    if (
      !selectedGame ||
      isLaunching ||
      !isGameInstalledOnSystem ||
      !isTranslationInstalled
    )
      return;

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
  }, [
    selectedGame,
    isLaunching,
    isGameInstalledOnSystem,
    isTranslationInstalled,
    showModal,
  ]);

  if (!selectedGame) {
    return (
      <div className="flex-1 grid items-center px-8 overflow-y-auto custom-scrollbar">
        <div className="grid grid-rows-auto gap-16 h-auto">
          <GamesSection title="Новинки" />
          <GamesSection title="Популярне у гравців" showDownloadCounter={true} />
        </div>
      </div>
    );
  }

  // Adult content overlay - show when adult game is selected but setting is off
  if (isAdultBlurred) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
        <div className="glass-card max-w-md p-8">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-red-500/20 to-pink-500/20 flex items-center justify-center">
            <EyeOff size={40} className="text-red-400" />
          </div>
          <h2 className="text-xl font-head font-semibold text-text-main mb-3">
            Контент для дорослих
          </h2>
          <p className="text-text-muted mb-6">
            Ця гра містить контент для дорослих (18+). Щоб переглянути цю гру, увімкніть
            відповідне налаштування.
          </p>
          <button
            onClick={openSettingsModal}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-color-accent to-color-main text-text-dark font-semibold hover:opacity-90 transition-opacity"
          >
            <Settings size={20} />
            Відкрити налаштування
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Install Options Dialog for games with voice archive */}
      {selectedGame && (
        <InstallOptionsDialog
          isOpen={showInstallOptions}
          onClose={() => setShowInstallOptions(false)}
          onConfirm={handleInstallOptionsConfirm}
          game={selectedGame}
          defaultCreateBackup={createBackupBeforeInstall}
          installationInfo={installationInfo}
          isCustomPath={
            !!pendingInstallPath ||
            installationInfo?.isCustomPath ||
            !isGameInstalledOnSystem
          }
        />
      )}

      {/* Author Subscription Modal - shows after first installation */}
      {selectedGame && selectedGame.team && (
        <AuthorSubscriptionModal
          isOpen={showAuthorSubscriptionModal}
          onClose={handleCloseAuthorSubscriptionModal}
          gameName={selectedGame.name}
          team={selectedGame.team}
        />
      )}

      <div
        data-gamepad-main-content
        className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar"
      >
        <GameHero game={selectedGame} />

        {/* Actions block */}
        <div className="glass-card mb-6">
          <div className="flex flex-wrap items-center gap-3">
            {/* Primary actions */}
            {selectedGame && isGameInstalledOnSystem && isTranslationInstalled && (
              <Button
                variant="green"
                icon={<Play size={20} />}
                onClick={handleLaunchGame}
                disabled={isLaunching || isInstalling || isUninstalling}
                data-gamepad-action
              >
                {isLaunching ? 'Запуск...' : 'Грати'}
              </Button>
            )}
            <Button
              variant={
                isGameInstalledOnSystem && isTranslationInstalled
                  ? 'secondary'
                  : 'primary'
              }
              icon={isUpdateAvailable ? <RefreshCw size={20} /> : <Download size={20} />}
              onClick={() => handleInstall()}
              disabled={isInstalling || isUninstalling || isPlanned || !isOnline}
              title={!isOnline ? 'Відсутнє підключення до Інтернету' : undefined}
              data-gamepad-primary-action
              data-gamepad-action
            >
              {getInstallButtonText()}
            </Button>
            {installationInfo && !isInstalling && (
              <Button
                variant="secondary"
                icon={<Trash2 size={20} />}
                onClick={handleUninstall}
                disabled={isUninstalling}
                data-gamepad-action
              >
                {isUninstalling ? 'Видалення...' : 'Видалити'}
              </Button>
            )}

            {/* Separator */}
            <div className="hidden sm:block w-0 h-10 border-l border-border-hover mx-2" />

            {/* Secondary actions */}
            {isPlanned && (
              <SubscribeButton
                gameId={selectedGame.id}
                gameName={selectedGame.name}
                gameStatus={selectedGame.status}
                variant="amber"
                data-gamepad-action
              />
            )}
            {selectedGame.support_url && (
              <Button
                variant="accent"
                icon={<Heart size={20} />}
                onClick={handleSupport}
                data-gamepad-action
              >
                Підтримати переклад
              </Button>
            )}
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

          {(isInstalling || isPaused) && (
            <div className="glass-card">
              {downloadProgress && downloadProgress.totalBytes > 0 ? (
                <DownloadProgressCard
                  progress={installProgress}
                  downloadProgress={downloadProgress}
                  isPaused={isPaused}
                  onPause={handlePauseDownload}
                  onResume={handleResumeDownload}
                  onCancel={handleCancelDownload}
                />
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
                <span className="text-sm font-medium text-text-main">
                  Видалення українізатора та відновлення оригінальних файлів...
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Author card */}
        {selectedGame.team && (
          <div className="glass-card mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${isSpecialTranslator(selectedGame.team) ? 'bg-yellow-500/20' : 'bg-neon-blue/20'}`}
                >
                  <Users
                    size={20}
                    className={
                      isSpecialTranslator(selectedGame.team)
                        ? 'text-yellow-400'
                        : 'text-neon-blue'
                    }
                  />
                </div>
                <div>
                  <div className="text-xs text-text-muted">
                    {selectedGame.team.includes(',')
                      ? 'Автори локалізації'
                      : 'Автор локалізації'}
                  </div>
                  <div className="font-medium text-text-main">
                    {selectedGame.team.split(',').map((author, index, arr) => {
                      const trimmedAuthor = author.trim();
                      const specialInfo = getSpecialTranslatorInfo(trimmedAuthor);
                      const isSpecial = specialInfo !== null;

                      return (
                        <span key={trimmedAuthor}>
                          <span className={isSpecial ? 'text-yellow-400' : ''}>
                            {trimmedAuthor}
                            {isSpecial && specialInfo && (
                              <Tooltip content={specialInfo.description}>
                                <Star
                                  size={12}
                                  className="ml-1 fill-yellow-400 text-yellow-400 cursor-help"
                                />
                              </Tooltip>
                            )}
                          </span>
                          {index < arr.length - 1 && (
                            <span className="text-text-main">, </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
              <TeamSubscribeButton teamName={selectedGame.team} data-gamepad-action />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <StatusCard game={selectedGame} />
          <InfoCard game={selectedGame} />
        </div>

        <div className="mb-6">
          <SocialLinksCard game={selectedGame} />
        </div>

        {selectedGame.fundraising_goal && selectedGame.fundraising_goal > 0 && (
          <div className="mb-6">
            <FundraisingProgressCard
              current={selectedGame.fundraising_current || 0}
              goal={selectedGame.fundraising_goal}
            />
          </div>
        )}

        {selectedGame.video_url && (
          <div className="mb-6">
            <VideoCard videoUrl={selectedGame.video_url} />
          </div>
        )}

        {selectedGame.description && (
          <div className="glass-card mb-6">
            <h3 className="text-lg font-head font-semibold text-text-main mb-3">
              Про українізатор
            </h3>
            <p className="text-text-muted leading-relaxed whitespace-pre-line">
              {selectedGame.description}
            </p>
          </div>
        )}

        {selectedGame.game_description && (
          <div className="glass-card mb-6">
            <h3 className="text-lg font-head font-semibold text-text-main mb-3">
              Про гру
            </h3>
            <p className="text-text-muted leading-relaxed whitespace-pre-line">
              {selectedGame.game_description}
            </p>
          </div>
        )}
      </div>
    </>
  );
};
