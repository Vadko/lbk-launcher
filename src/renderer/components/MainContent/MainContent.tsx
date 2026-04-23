import { useGamepadModeStore } from '@store/useGamepadModeStore.ts';
import { useModalStore } from '@store/useModalStore.ts';
import { useSettingsStore } from '@store/useSettingsStore.ts';
import { useStore } from '@store/useStore.ts';
import { useSubscriptionsStore } from '@store/useSubscriptionsStore.ts';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import {
  AlertTriangle,
  Download,
  EyeOff,
  Heart,
  Play,
  RefreshCw,
  ReplaceAllIcon,
  Settings,
  Trash2,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BannerData, GameBannersResult } from '@/main/db/banners-api';
import type { BannerType, LaunchGameResult } from '@/shared/types.ts';
import { isSpecialTranslator } from '../../constants/specialTranslators';
import { getLanguageHint } from '../../helpers/getLanguageHint';
import { useInstallation } from '../../hooks/useInstallation';
import { trackEvent } from '../../utils/analytics';
import { AuthorSubscriptionModal } from '../Modal/AuthorSubscriptionModal';
import { FeedbackModal } from '../Modal/FeedbackModal';
import { InstallOptionsDialog } from '../Modal/InstallOptionsDialog';
import { Placement } from '../Placements';
import { Button } from '../ui/Button';
import { SubscribeButton } from '../ui/SubscribeButton';
import { TeamSubscribeButton } from '../ui/TeamSubscribeButton';
import { AuthorsList } from './AuthorsList';
import { DownloadProgressCard } from './DownloadProgressCard';
import { FundraisingProgressCard } from './FundraisingProgressCard';
import { GameHero } from './GameHero';
import { GamesSection } from './GamesSection';
import { InfoCard } from './InfoCard';
import { InstallationStatusBadge } from './InstallationStatusBadge';
import { InstallationStatusMessage } from './InstallationStatusMessage';
import { SocialLinksCard } from './SocialLinksCard';
import { StatusCard } from './StatusCard';
import { VideoCard } from './VideoCard';

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
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [bannerData, setBannerData] = useState<GameBannersResult | null>(null);
  const [loadedBannerGameId, setLoadedBannerGameId] = useState<string | null>(null);
  const bannerCacheRef = useRef<Map<string, GameBannersResult>>(new Map());

  const installationInfo = selectedGame ? installedGames.get(selectedGame.id) : undefined;
  const isCheckingInstallation = selectedGame
    ? isCheckingInstallationStatus(selectedGame.id)
    : false;

  const isGameInstalledOnSystem = selectedGame ? isGameDetected(selectedGame.id) : false;
  const isTranslationInstalled =
    installationInfo &&
    !installationInfo.hasInstallError &&
    installationInfo.gameId === selectedGame?.id;
  const isUpdateAvailable =
    installationInfo &&
    selectedGame &&
    selectedGame.version &&
    installationInfo.version !== selectedGame.version;
  const isPlanned = selectedGame?.status === 'planned';
  const isAdultBlurred = selectedGame?.is_adult && !showAdultGames;

  // Load banner data for selected game with delay to prevent flickering
  useEffect(() => {
    let isMounted = true;

    const loadBannerData = async () => {
      if (!selectedGame?.id) {
        setBannerData(null);
        setLoadedBannerGameId(null);
        return;
      }

      // Check cache first - show immediately from cache
      const cachedData = bannerCacheRef.current.get(selectedGame.id);
      if (cachedData) {
        setBannerData(cachedData);
        setLoadedBannerGameId(selectedGame.id);
        return;
      }

      try {
        const result = await window.electronAPI.fetchBannersForGame(
          selectedGame.id,
          selectedGame.slug
        );
        if (!isMounted) return;

        // Cache the result
        bannerCacheRef.current.set(selectedGame.id, result);

        if (isMounted) {
          setBannerData(result);
          setLoadedBannerGameId(selectedGame.id);
        }
      } catch (error) {
        if (!isMounted) return;
        console.error('Error loading banner data:', error);
        setBannerData(null);
        setLoadedBannerGameId(selectedGame.id);
      }
    };

    loadBannerData();

    return () => {
      isMounted = false;
    };
  }, [selectedGame?.id, selectedGame?.slug]);

  const prevBannerInfoRef = useRef<{
    data: BannerData | null;
    isKuli: boolean;
    support_url: string | null;
    placementType: BannerType | null;
  }>({ data: null, isKuli: false, support_url: null, placementType: null });

  const bannerInfo = useMemo(() => {
    if (!selectedGame) {
      prevBannerInfoRef.current = {
        data: null,
        isKuli: false,
        support_url: null,
        placementType: null,
      };
      return prevBannerInfoRef.current;
    }

    // Check cache directly to avoid flickering when switching between cached games
    const cachedData = bannerCacheRef.current.get(selectedGame.id);

    // If we have cached data for this game, use it immediately
    if (cachedData) {
      const type =
        cachedData.banner?.type ??
        (cachedData.isKuli ? 'narrow' : null) ??
        (selectedGame.support_url ? 'small_square' : null) ??
        null;

      const info = {
        data: cachedData.banner || null,
        isKuli: cachedData.isKuli || false,
        support_url: selectedGame?.support_url || null,
        placementType: type,
      };
      prevBannerInfoRef.current = info;
      return info;
    }

    // If not in cache and not loaded for this game yet,
    // keep previous banner to avoid flicker
    if (loadedBannerGameId !== selectedGame.id) {
      return prevBannerInfoRef.current;
    }

    const type =
      bannerData?.banner?.type ??
      (bannerData?.isKuli ? 'narrow' : null) ??
      (selectedGame.support_url ? 'small_square' : null) ??
      null;

    const info = {
      data: bannerData?.banner || null,
      isKuli: bannerData?.isKuli || false,
      support_url: selectedGame?.support_url || null,
      placementType: type,
    };
    prevBannerInfoRef.current = info;
    return info;
  }, [selectedGame, bannerData, loadedBannerGameId]);

  // Record banner impression: Mixpanel + Supabase together
  const trackBannerImpression = useCallback(
    (action: 'view' | 'click') => {
      const banner = bannerInfo?.data;
      const content = banner?.id ? 'ads' : bannerInfo?.isKuli ? 'kuli' : 'support';

      trackEvent('ads-placement', {
        ...(banner?.id ? { 'Banner Id': banner.id } : {}),
        Content: content,
        Type: bannerInfo?.placementType ?? 'unknown',
        'Game Name': selectedGame?.name ?? '',
        'Game Id': selectedGame?.id ?? '',
        Action: action,
      });

      if (banner?.id) {
        window.electronAPI?.recordBannerImpression?.(banner.id, action);
      }
    },
    [bannerInfo, selectedGame]
  );

  const handleBannerView = useCallback(() => {
    trackBannerImpression('view');
  }, [trackBannerImpression]);

  const handleBannerClick = useCallback(() => {
    trackBannerImpression('click');
  }, [trackBannerImpression]);

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
    handleRerunInstaller,
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

    // Track support click
    if (window.electronAPI?.trackSupportClick) {
      window.electronAPI.trackSupportClick(selectedGame.id);
    }

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
      <div
        data-gamepad-main-content
        className={`flex-1 grid items-center px-8 ${useGamepadModeStore.getState().isGamepadMode && 'pb-3'} overflow-y-auto justify-center custom-scrollbar scrollbar-gutter-[stable]`}
      >
        <div className="grid grid-rows-auto gap-10 h-auto">
          <GamesSection title="Новинки" sortOrder="newest" />
          <GamesSection
            title="Популярне у гравців"
            showDownloadCounter={true}
            showTrendsGames={true}
          />
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

      {/* Feedback Modal */}
      {selectedGame && (
        <FeedbackModal
          isOpen={showFeedbackModal}
          onClose={() => setShowFeedbackModal(false)}
          gameId={selectedGame.id}
          gameName={selectedGame.name}
        />
      )}

      <div
        data-gamepad-main-content
        className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar"
      >
        <LayoutGroup>
          <GameHero game={selectedGame} />

          {/* Actions block */}
          <div className="glass-card mb-6 grid gap-6">
            <div className="flex flex-wrap items-center gap-3">
              {/* Primary actions */}
              {selectedGame && isGameInstalledOnSystem && isTranslationInstalled && (
                <Button
                  variant="primary"
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
                icon={
                  isUpdateAvailable ? <RefreshCw size={20} /> : <Download size={20} />
                }
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
              {installationInfo?.installerPath && !isInstalling && !isUninstalling && (
                <Button
                  variant="secondary"
                  icon={<ReplaceAllIcon size={20} />}
                  onClick={handleRerunInstaller}
                  data-gamepad-action
                  title="Запустити інсталятор повторно"
                >
                  Перевстановити
                </Button>
              )}

              {/* Separator */}
              <div className="hidden sm:block w-0 h-10 border-l border-border-hover mx-2 last:hidden" />

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
              {selectedGame.support_url &&
                bannerInfo.placementType &&
                !(
                  bannerInfo.placementType === 'small_square' && !bannerInfo.data?.id
                ) && (
                  <Button
                    variant="accent"
                    icon={<Heart size={20} />}
                    onClick={handleSupport}
                    data-gamepad-action
                    className="support-button"
                  >
                    Підтримати переклад
                  </Button>
                )}
            </div>

            {(() => {
              const langHint = getLanguageHint(selectedGame.source_language);
              return langHint ? (
                <div className="flex gap-2">
                  <span className="w-0 h-auto border-l border-border-hover" />
                  <span className="text-sm">
                    В налаштуваннях гри оберіть{' '}
                    <span className="text-color-accent">{langHint} мову</span>
                  </span>
                </div>
              ) : null;
            })()}
          </div>

          <div className="space-y-4 mb-6">
            {installationInfo && !isCheckingInstallation && !isInstalling && (
              <InstallationStatusBadge
                isUpdateAvailable={!!isUpdateAvailable}
                installedVersion={installationInfo.version}
                hasInstallError={installationInfo.hasInstallError}
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
                    <AuthorsList team={selectedGame.team} maxVisible={3} />
                  </div>
                </div>
                <TeamSubscribeButton teamName={selectedGame.team} data-gamepad-action />
              </div>
            </div>
          )}

          <AnimatePresence mode="wait">
            {bannerInfo.placementType === 'narrow' && (
              <motion.div
                key="narrow"
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Placement
                  banner={bannerInfo.data}
                  placementType="narrow"
                  gameId={selectedGame.id}
                  gameName={selectedGame.name}
                  isKuli={bannerInfo.isKuli}
                  onView={handleBannerView}
                  onClick={handleBannerClick}
                  className="placement-long"
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-w-0">
              <StatusCard game={selectedGame} />
              <InfoCard game={selectedGame} />
            </div>
            <motion.div
              animate={{
                width: bannerInfo.placementType === 'small_square' ? 320 : 0,
                opacity: bannerInfo.placementType === 'small_square' ? 1 : 0,
                display: bannerInfo.placementType === 'small_square' ? 'block' : 'none',
              }}
              initial={false}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="overflow-x-clip flex-shrink-0"
            >
              <div className="w-[320px] h-full">
                <Placement
                  banner={bannerInfo.data}
                  placementType="small_square"
                  gameId={selectedGame.id}
                  gameName={selectedGame.name}
                  supportUrl={selectedGame.support_url || undefined}
                  onView={handleBannerView}
                  onClick={handleBannerClick}
                  className="placement h-full"
                />
              </div>
            </motion.div>
          </div>

          <motion.div
            layout="position"
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="flex gap-4 mb-6"
          >
            <div className="flex-1 min-w-0">
              <SocialLinksCard game={selectedGame} />
            </div>
            <AnimatePresence>
              {isTranslationInstalled && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 320, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="overflow-visible flex-shrink-0"
                >
                  <div className="glass-card h-full flex flex-col justify-center gap-4 w-[320px] p-6">
                    <h3 className="text-base font-semibold text-text-main">
                      Знайшли помилку?
                    </h3>
                    <button
                      onClick={() => setShowFeedbackModal(true)}
                      data-gamepad-action
                      className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-border text-sm font-medium text-text-main hover:bg-glass-hover transition-colors"
                    >
                      <AlertTriangle size={16} />
                      Повідомити про помилку
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {selectedGame.fundraising_goal && selectedGame.fundraising_goal > 0 && (
            <motion.div
              layout="position"
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="mb-6"
            >
              <FundraisingProgressCard
                current={selectedGame.fundraising_current || 0}
                goal={selectedGame.fundraising_goal}
                supportUrl={selectedGame.support_url}
              />
            </motion.div>
          )}

          {selectedGame.video_url && (
            <motion.div
              layout="position"
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="mb-6"
            >
              <VideoCard videoUrl={selectedGame.video_url} />
            </motion.div>
          )}

          {selectedGame.description && (
            <motion.div
              layout="position"
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="glass-card mb-6"
            >
              <h3 className="text-lg font-head font-semibold text-text-main mb-3">
                Про українізатор
              </h3>
              <p className="text-text-muted leading-relaxed whitespace-pre-line">
                {selectedGame.description}
              </p>
            </motion.div>
          )}

          {selectedGame.game_description && (
            <motion.div
              layout="position"
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="glass-card mb-6"
            >
              <h3 className="text-lg font-head font-semibold text-text-main mb-3">
                Про гру
              </h3>
              <p className="text-text-muted leading-relaxed whitespace-pre-line">
                {selectedGame.game_description}
              </p>
            </motion.div>
          )}
        </LayoutGroup>
      </div>
    </>
  );
};
