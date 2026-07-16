import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import {
  Download,
  EyeOff,
  FileEdit,
  Heart,
  Play,
  RefreshCw,
  ReplaceAllIcon,
  Settings,
  Trash2,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { BannerData, GameBannersResult } from '@/main/db/banners-api';
import type { BannerType, LaunchGameResult } from '@/shared/types.ts';
import { AuthorsList } from '../components/MainContent/AuthorsList';
import { DownloadProgressCard } from '../components/MainContent/DownloadProgressCard';
import { FundraisingProgressCard } from '../components/MainContent/FundraisingProgressCard';
import { SwiperSlider } from '../components/MainContent/Gallery';
import { GameHero } from '../components/MainContent/GameHero';
import { ImportantNotice } from '../components/MainContent/ImportantNotice';
import { InfoCard } from '../components/MainContent/InfoCard';
import { InstallationStatusBadge } from '../components/MainContent/InstallationStatusBadge';
import { InstallationStatusMessage } from '../components/MainContent/InstallationStatusMessage';
import { RecommendedGamesSection } from '../components/MainContent/RecommendedGamesSection';
import { SocialLinksCard } from '../components/MainContent/SocialLinksCard';
import { StatusCard } from '../components/MainContent/StatusCard';
import { VideoCard } from '../components/MainContent/VideoCard';
import { AuthorSubscriptionModal } from '../components/Modal/AuthorSubscriptionModal';
import { FeedbackModal } from '../components/Modal/FeedbackModal';
import { InstallOptionsDialog } from '../components/Modal/InstallOptionsDialog';
import { Placement } from '../components/Placements';
import { Button } from '../components/ui/Button';
import { SubscribeButton } from '../components/ui/SubscribeButton';
import { TeamSubscribeButton } from '../components/ui/TeamSubscribeButton';
import { isSpecialTranslator } from '../constants/specialTranslators';
import { useGameTombstone } from '../hooks/useGameTombstone';
import { useInstallation } from '../hooks/useInstallation';
import { useGamepadModeStore } from '../store/useGamepadModeStore';
import { useModalStore } from '../store/useModalStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useStore } from '../store/useStore';
import { useSubscriptionsStore } from '../store/useSubscriptionsStore';
import { trackEvent } from '../utils/analytics';
import { isTranslationInstallable } from '../utils/gameStatus';

/**
 * Сторінка детальної інформації про гру
 * Відображає всю інформацію, банери, кнопки встановлення тощо
 */
export const GamePage: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();

  const {
    selectedGame,
    setSelectedGame,
    checkInstallationStatus,
    isCheckingInstallationStatus,
    isGameDetected,
    installedTranslations,
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
  const isTombstoned = useGameTombstone(gameId);

  const installationInfo = selectedGame
    ? installedTranslations.get(selectedGame.id)
    : undefined;
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
  const isInstallable = selectedGame
    ? isTranslationInstallable(selectedGame.status)
    : false;
  const isAdultBlurred = selectedGame?.is_adult && !showAdultGames;

  // Завантажити гру якщо її ще немає в selectedGame
  useEffect(() => {
    if (!gameId) {
      navigate('/');
      return;
    }

    let isCancelled = false; // Race condition protection

    const loadGame = async () => {
      // Якщо вже є вибрана гра з правильним ID, не треба перезавантажувати
      if (selectedGame?.id === gameId) {
        return;
      }

      // Очищаємо selectedGame якщо змінився gameId (щоб не показувати стару гру)
      // Я хз нашо додавав але здається це викликає проблеми з геймпадом і зміною ігр
      // if (selectedGame?.id && selectedGame.id !== gameId) {
      //   setSelectedGame(null);
      // }

      try {
        const games = await window.electronAPI.fetchGamesByIds([gameId]);

        // Перевірка чи не відмінено запит (користувач перейшов на іншу гру)
        if (isCancelled) {
          console.log('[GamePage] Request cancelled, not updating selectedGame');
          return;
        }

        if (games.length > 0) {
          // Додаткова перевірка: чи все ще той самий gameId в URL
          // (захист від швидких кліків на різні ігри)
          if (games[0].id === gameId) {
            setSelectedGame(games[0]);
          } else {
            console.log('[GamePage] Game ID mismatch, skipping setSelectedGame');
          }
        } else {
          // Гру не знайдено, повертаємось на головну
          navigate('/');
        }
      } catch (error) {
        console.error('[GamePage] Failed to load game:', error);
        // Не навігуємо якщо запит відмінено
        if (!isCancelled) {
          navigate('/');
        }
      }
    };

    loadGame();

    // Cleanup: позначити запит як скасований при розмонтуванні або зміні gameId
    return () => {
      isCancelled = true;
    };
  }, [gameId, selectedGame, setSelectedGame, navigate]);

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
        if (!isMounted) {
          return;
        }

        // Cache the result
        bannerCacheRef.current.set(selectedGame.id, result);

        if (isMounted) {
          setBannerData(result);
          setLoadedBannerGameId(selectedGame.id);
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }
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
    isWaitingForNetwork,
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
    availablePlatforms,
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
      console.log('[GamePage] Internet connection restored');
    };

    const handleOffline = async () => {
      setIsOnline(false);
      console.log('[GamePage] Internet connection lost');

      // Don't abort if paused or already waiting — download is already stopped
      if (selectedGame && isInstalling && !isPaused && !isWaitingForNetwork) {
        console.log('[GamePage] Aborting download due to connection loss');
        await window.electronAPI?.abortDownload('NETWORK_LOST');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [selectedGame, isInstalling, isPaused, isWaitingForNetwork]);

  const handleSupport = useCallback(() => {
    if (!selectedGame?.support_url) {
      return;
    }

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
    ) {
      return;
    }

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
  // Early return якщо немає гри (після всіх хуків!)
  if (!selectedGame) {
    return null;
  }
  // Adult content overlay
  if (isAdultBlurred) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
        <div className="glass-card-no-motion max-w-md p-8">
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
          availablePlatforms={availablePlatforms}
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
        className={`flex-1 overflow-y-auto px-8 custom-scrollbar grid gap-6 ${useGamepadModeStore.getState().isGamepadMode && 'py-6'}`}
      >
        <LayoutGroup>
          <GameHero game={selectedGame} />

          {isTombstoned && (
            <div className="glass-card-no-motion border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-100">
              Цей переклад більше не доступний у каталозі. Ви можете лише видалити
              локалізацію — повторне встановлення недоступне.
            </div>
          )}

          {/* Actions block */}
          <div className="glass-card-no-motion grid gap-6">
            <div className="flex flex-wrap items-center gap-3">
              {/* Primary actions */}
              {selectedGame && isGameInstalledOnSystem && isTranslationInstalled && (
                <Button
                  variant="primary"
                  icon={<Play size={20} />}
                  onClick={handleLaunchGame}
                  disabled={isLaunching || isInstalling || isUninstalling}
                  data-gamepad-action
                  data-gamepad-primary-action
                >
                  Грати
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
                disabled={
                  isInstalling ||
                  isUninstalling ||
                  !isInstallable ||
                  !isOnline ||
                  isTombstoned
                }
                title={
                  isTombstoned
                    ? 'Переклад більше не доступний у каталозі'
                    : !isOnline
                      ? 'Відсутнє підключення до Інтернету'
                      : undefined
                }
                data-gamepad-primary-action
                data-gamepad-action
              >
                {getInstallButtonText()}
              </Button>
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
              {installationInfo && !isInstalling && (
                <Button
                  variant="secondary"
                  icon={<Trash2 size={20} />}
                  onClick={handleUninstall}
                  disabled={isUninstalling}
                  data-gamepad-action
                ></Button>
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
                    Підтримати
                  </Button>
                )}
              {isTranslationInstalled && (
                <Button
                  variant="secondary"
                  icon={<FileEdit size={20} />}
                  onClick={() => setShowFeedbackModal(true)}
                  data-gamepad-action
                  className="support-button"
                >
                  Лишити відгук
                </Button>
              )}
            </div>

            <div className="flex gap-3 flex-wrap">
              {installationInfo && !isCheckingInstallation && !isInstalling && (
                <>
                  <InstallationStatusBadge
                    isUpdateAvailable={!!isUpdateAvailable}
                    installedVersion={installationInfo.version}
                    hasInstallError={installationInfo.hasInstallError}
                    newVersion={selectedGame?.version}
                  />
                  <div className="divider w-0 h-auto border-l border-border-hover last:hidden" />
                </>
              )}
              <ImportantNotice game={selectedGame} />
            </div>
          </div>

          {(isInstalling || isPaused || isWaitingForNetwork || isUninstalling) ?? (
            <div className="space-y-4">
              {(isInstalling || isPaused || isWaitingForNetwork) && (
                <div className="glass-card-no-motion">
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
                    <div>
                      <InstallationStatusMessage
                        statusMessage={statusMessage}
                        isUpdateAvailable={!!isUpdateAvailable}
                        isOnline={isOnline}
                        isInstalling={isInstalling}
                      />
                      {isWaitingForNetwork && (
                        <div className="mt-3 flex justify-end">
                          <button
                            onClick={handleCancelDownload}
                            className="px-4 py-1.5 rounded-lg text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors"
                          >
                            Скасувати
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {isUninstalling && (
                <div className="glass-card-no-motion">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm font-medium text-text-main">
                      Видалення українізатора та відновлення оригінальних файлів...
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Author card */}
          {selectedGame.team && (
            <div className="glass-card-no-motion">
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

          {/* Recommended */}
          <RecommendedGamesSection
            gameId={selectedGame.id}
            gameName={selectedGame.name}
            showLimit={3}
          />

          {/* Narrow placement */}
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

          {/* Info cards */}
          <div className="flex flex-col lg:flex-row gap-4">
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
              className="overflow-x-clip flex-shrink-0 mb-auto"
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

          {/* Donate */}
          {selectedGame.fundraising_goal && selectedGame.fundraising_goal > 0 && (
            <motion.div layout="position" transition={{ duration: 0.2, ease: 'easeOut' }}>
              <FundraisingProgressCard
                current={selectedGame.fundraising_current || 0}
                goal={selectedGame.fundraising_goal}
                supportUrl={selectedGame.support_url}
              />
            </motion.div>
          )}

          {/* Translate description */}
          {selectedGame.description && (
            <motion.section
              layout="position"
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="glass-card-no-motion"
            >
              <h3 className="text-lg font-head font-semibold text-text-main mb-3">
                Про українізатор
              </h3>
              <p className="text-text-muted leading-relaxed whitespace-pre-line">
                {selectedGame.description}
              </p>
            </motion.section>
          )}

          {/* Video */}
          {selectedGame.video_url && (
            <motion.div layout="position" transition={{ duration: 0.2, ease: 'easeOut' }}>
              <VideoCard videoUrl={selectedGame.video_url} />
            </motion.div>
          )}

          {/* Gallery */}
          {selectedGame.screenshots && (
            <motion.section
              layout="position"
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <div className="glass-card-no-motion">
                <SwiperSlider
                  slides={selectedGame.screenshots}
                  spaceBetween={30}
                  slidesPerView={3}
                  pagination={false}
                  thumbs={true}
                  loop={true}
                  updated_at={selectedGame.updated_at}
                />
              </div>
            </motion.section>
          )}

          {/* Game description */}
          {selectedGame.game_description && (
            <motion.section
              layout="position"
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="glass-card-no-motion"
            >
              <h3 className="text-lg font-head font-semibold text-text-main mb-3">
                Про гру
              </h3>
              <p className="text-text-muted leading-relaxed whitespace-pre-line">
                {selectedGame.game_description}
              </p>
            </motion.section>
          )}

          {/* Links */}
          <motion.div
            layout="position"
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="flex gap-4"
          >
            <div className="flex-1 min-w-0">
              <SocialLinksCard game={selectedGame} />
            </div>
          </motion.div>
        </LayoutGroup>
      </div>
    </>
  );
};
