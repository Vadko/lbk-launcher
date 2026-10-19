import { FolderOpen, Gamepad, Library, LockOpen, RefreshCw } from 'lucide';
import {
  BrushCleaningIcon,
  FileTextIcon,
  HeartIcon,
  MessageCircleIcon,
  PlayIcon,
  Settings2Icon,
  ShieldIcon,
  SparklesIcon,
  Trash2Icon,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useActionPhase } from '@/renderer/hooks/useActionPhase';
import { useModalStore } from '@/renderer/store/useModalStore';
import { t } from '@/shared/i18n/i18n';
import type { SteamCollectionSyncFailure } from '@/shared/types';
import { APP_VERSION } from '../../constants/appVersion';
import { SPECIAL_TRANSLATORS } from '../../constants/specialTranslators';
import { useChangelogStore } from '../../store/useChangelogStore';
import { type DevModeType, usePromoModalStore } from '../../store/usePromoModalStore';
import { isHardwareWeak, useSettingsStore } from '../../store/useSettingsStore';
import { trackEvent } from '../../utils/analytics';
import {
  playBackSound,
  playConfirmSound,
  playNavigateSound,
} from '../../utils/gamepadSounds';
import { playNotificationSound } from '../../utils/notificationSounds';
import { Modal } from '../Modal/Modal';
import { PrivacyPolicyModal } from '../Modal/PrivacyPolicyModal';
import { SendLogsModal } from '../Modal/SendLogsModal';
import { TermsOfServiceModal } from '../Modal/TermsOfServiceModal';
import { AppActionIcon } from '../ui/AppActionIcon';
import { Button } from '../ui/Button';
import { SelectDropdown } from '../ui/SelectDropdown';
import { Switch } from '../ui/Switch';
import { SteamBridgeStatusCard } from './SteamBridgeStatusCard';

const SettingItem = React.memo<{
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  onChange: () => void;
  disabled?: boolean;
}>(({ id, title, description, enabled, onChange, disabled = false }) => (
  <div className="flex items-center justify-between p-4 rounded-xl bg-glass border border-border">
    <div className="flex-1 pr-4">
      <h4 className="text-sm font-semibold text-text-main mb-1">{title}</h4>
      <p className="text-xs text-text-muted">{description}</p>
    </div>
    <Switch
      id={`switch-${id}`}
      checked={enabled}
      onCheckedChange={onChange}
      disabled={disabled}
    />
  </div>
));

SettingItem.displayName = 'SettingItem';

const STEAM_ACTION_ERRORS: Record<
  SteamCollectionSyncFailure,
  (purpose: string) => string
> = {
  'steam-not-running': () => t('steamActionErrors.steamNotRunning'),
  'cef-unavailable': (purpose) => t('steamActionErrors.cefUnavailable', { purpose }),
  'cef-blocked': (purpose) => t('steamActionErrors.cefBlocked', { purpose }),
  'millennium-plugin-pending': (purpose) =>
    t('steamActionErrors.millenniumPluginPending', { purpose }),
  'millennium-outdated': (purpose) =>
    t('steamActionErrors.millenniumOutdated', { purpose }),
  'library-unavailable': () => t('steamActionErrors.libraryUnavailable'),
  'no-translated-games': () => t('steamActionErrors.noTranslatedGames'),
  'no-matches': () => t('steamActionErrors.noMatches'),
  failed: () => t('steamActionErrors.failed'),
};

function steamActionErrorMessage(
  reason: SteamCollectionSyncFailure,
  purpose: string
): string {
  return STEAM_ACTION_ERRORS[reason](purpose);
}

export const SettingsModal: React.FC = () => {
  const { showModal } = useModalStore();
  const isSettingsModalOpen = useSettingsStore((state) => state.isSettingsModalOpen);
  const closeSettingsModal = useSettingsStore((state) => state.closeSettingsModal);
  const animationsEnabled = useSettingsStore((state) => state.animationsEnabled);
  const toggleAnimations = useSettingsStore((state) => state.toggleAnimations);
  const createBackupBeforeInstall = useSettingsStore(
    (state) => state.createBackupBeforeInstall
  );
  const toggleCreateBackup = useSettingsStore((state) => state.toggleCreateBackup);
  const showAdultGames = useSettingsStore((state) => state.showAdultGames);
  const toggleShowAdultGames = useSettingsStore((state) => state.toggleShowAdultGames);
  const hideAiTranslations = useSettingsStore((state) => state.hideAiTranslations);
  const toggleHideAiTranslations = useSettingsStore(
    (state) => state.toggleHideAiTranslations
  );
  const showRecommendations = useSettingsStore((state) => state.showRecommendations);
  const toggleRecommendations = useSettingsStore((state) => state.toggleRecommendations);
  const liquidGlassEnabled = useSettingsStore((state) => state.liquidGlassEnabled);
  const toggleLiquidGlass = useSettingsStore((state) => state.toggleLiquidGlass);
  // Sound settings
  const notificationSoundsEnabled = useSettingsStore(
    (state) => state.notificationSoundsEnabled
  );
  const toggleNotificationSounds = useSettingsStore(
    (state) => state.toggleNotificationSounds
  );
  const gamepadSoundsEnabled = useSettingsStore((state) => state.gamepadSoundsEnabled);
  const toggleGamepadSounds = useSettingsStore((state) => state.toggleGamepadSounds);
  const steamCefDebuggingEnabled = useSettingsStore(
    (state) => state.steamCefDebuggingEnabled
  );
  const toggleSteamCefDebugging = useSettingsStore(
    (state) => state.toggleSteamCefDebugging
  );
  const steamCustomArtworkEnabled = useSettingsStore(
    (state) => state.steamCustomArtworkEnabled
  );
  const toggleSteamCustomArtwork = useSettingsStore(
    (state) => state.toggleSteamCustomArtwork
  );
  const productAnalyticsEnabled = useSettingsStore(
    (state) => state.productAnalyticsEnabled
  );
  const toggleProductAnalytics = useSettingsStore(
    (state) => state.toggleProductAnalytics
  );
  const localizationAnalyticsEnabled = useSettingsStore(
    (state) => state.localizationAnalyticsEnabled
  );
  const toggleLocalizationAnalytics = useSettingsStore(
    (state) => state.toggleLocalizationAnalytics
  );
  const crashDiagnosticsEnabled = useSettingsStore(
    (state) => state.crashDiagnosticsEnabled
  );
  const toggleCrashDiagnostics = useSettingsStore(
    (state) => state.toggleCrashDiagnostics
  );

  // Promo modal dev settings
  const { devMode, setDevMode } = usePromoModalStore();

  // Check if liquid glass is supported
  const [isLiquidGlassSupported, setIsLiquidGlassSupported] = useState(false);

  // Legal modals state
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [isSendLogsModalOpen, setIsSendLogsModalOpen] = useState(false);
  const unhideTranslationInputRef = useRef<HTMLInputElement>(null);
  const {
    phase: steamCollectionPhase,
    isPending: isSyncingSteamCollection,
    run: runSteamCollectionSync,
  } = useActionPhase();
  const {
    phase: lbkShortcutPhase,
    isPending: isTogglingLbkShortcut,
    run: runLbkShortcut,
  } = useActionPhase();
  const {
    phase: kurinSyncPhase,
    isPending: isSyncingKurin,
    isBusy: isKurinSyncBusy,
    run: runKurinSync,
  } = useActionPhase();

  const kurinSyncResultRef = useRef<string[] | null>(null);
  const {
    phase: unlockPhase,
    isPending: isUnlockingTranslation,
    run: runUnlockTranslation,
  } = useActionPhase();

  const [isTogglingSteamCef, setIsTogglingSteamCef] = useState(false);
  const [isTogglingSteamArtwork, setIsTogglingSteamArtwork] = useState(false);
  const {
    phase: logsFolderPhase,
    isPending: isOpeningLogsFolder,
    run: runOpenLogsFolder,
  } = useActionPhase();

  useEffect(() => {
    // Check if liquid glass is supported on this system
    window.liquidGlassAPI?.isSupported().then((supported) => {
      setIsLiquidGlassSupported(supported);
    });
  }, []);

  const handleToggleLiquidGlass = async () => {
    const newValue = !liquidGlassEnabled;
    toggleLiquidGlass();
    // Apply the change immediately
    await window.liquidGlassAPI?.toggle(newValue);
  };

  const handleToggleSteamCefDebugging = async () => {
    if (isTogglingSteamCef) {
      return;
    }
    const newValue = !steamCefDebuggingEnabled;
    toggleSteamCefDebugging();

    setIsTogglingSteamCef(true);
    try {
      await window.electronAPI.setSteamCefDebugging(newValue);
    } catch (error) {
      console.error('[Settings] Steam CEF debugging toggle failed:', error);
      toggleSteamCefDebugging();
    } finally {
      setIsTogglingSteamCef(false);
    }
  };

  const handleToggleSteamCustomArtwork = async () => {
    if (isTogglingSteamArtwork) {
      return;
    }
    const newValue = !steamCustomArtworkEnabled;
    toggleSteamCustomArtwork();
    setIsTogglingSteamArtwork(true);
    try {
      await window.electronAPI.setSteamCustomArtwork(newValue);
    } catch (error) {
      console.error('[Settings] Steam custom artwork toggle failed:', error);
      toggleSteamCustomArtwork();
    } finally {
      setIsTogglingSteamArtwork(false);
    }
  };

  const handleSyncSteamCollection = useCallback(async () => {
    if (isSyncingSteamCollection) {
      return;
    }
    try {
      const result = await runSteamCollectionSync(
        () => window.electronAPI.syncSteamTranslatedCollection(),
        { isSuccess: (r) => r.ok }
      );
      if (result.ok) {
        showModal({
          title: t('settings.collection.updatedTitle'),
          message:
            result.total === 0
              ? t('settings.collection.updatedEmpty')
              : t('settings.collection.updated', { count: result.total }),
          type: 'info',
        });
      } else {
        showModal({
          title: t('settings.collection.failedTitle'),
          message: steamActionErrorMessage(
            result.reason,
            t('steamActionPurposes.manageCollections')
          ),
          type: 'error',
        });
      }
    } catch (error) {
      console.error('[Settings] Steam collection sync failed:', error);
      showModal({
        title: t('settings.collection.failedTitle'),
        message: t('settings.unexpectedError'),
        type: 'error',
      });
    }
  }, [showModal, isSyncingSteamCollection, runSteamCollectionSync]);

  const handleAddLbkToSteamLibrary = useCallback(async () => {
    if (isTogglingLbkShortcut) {
      return;
    }
    try {
      const result = await runLbkShortcut(
        () => window.electronAPI.addLbkLauncherToSteamLibrary(),
        { isSuccess: (r) => r.ok }
      );
      if (result.ok) {
        showModal({
          title: t('settings.lbkShortcut.addedTitle'),
          message: t('settings.lbkShortcut.addedMessage'),
          type: 'info',
        });
      } else {
        showModal({
          title: t('settings.lbkShortcut.failedTitle'),
          message: steamActionErrorMessage(
            result.reason,
            t('steamActionPurposes.addShortcut')
          ),
          type: 'error',
        });
      }
    } catch (error) {
      console.error('[Settings] Adding LBK to Steam library failed:', error);
      showModal({
        title: t('settings.lbkShortcut.errorTitle'),
        message: t('settings.lbkShortcut.errorMessage'),
        type: 'error',
      });
    }
  }, [showModal, isTogglingLbkShortcut, runLbkShortcut]);

  const handleKurinSync = useCallback(async () => {
    if (isSyncingKurin) {
      return;
    }
    kurinSyncResultRef.current = null;
    let syncedGameNames: string[];
    try {
      syncedGameNames = await runKurinSync(() => window.electronAPI.syncKurinGames());
    } catch (error) {
      console.error('[Settings] Kurin sync failed:', error);
      showModal({
        title: t('settings.kurin.failedTitle'),
        message: t('settings.unexpectedError'),
        type: 'error',
      });
      return;
    }
    kurinSyncResultRef.current = syncedGameNames;
  }, [showModal, isSyncingKurin, runKurinSync]);

  const showKurinSyncResult = useCallback((synced: string[]) => {
    useModalStore.getState().showModal({
      title: t('settings.kurin.doneTitle'),
      message:
        synced.length > 0
          ? t('settings.kurin.synced', { count: synced.length, games: synced.join(', ') })
          : t('settings.kurin.none'),
      type: 'info',
    });
  }, []);

  useEffect(() => {
    const synced = kurinSyncResultRef.current;
    if (synced === null || isKurinSyncBusy) {
      return;
    }
    kurinSyncResultRef.current = null;
    closeSettingsModal();
    showKurinSyncResult(synced);
  }, [isKurinSyncBusy, closeSettingsModal, showKurinSyncResult]);

  useEffect(
    () => () => {
      const synced = kurinSyncResultRef.current;
      if (synced === null) {
        return;
      }
      kurinSyncResultRef.current = null;
      showKurinSyncResult(synced);
    },
    [showKurinSyncResult]
  );

  const handleClearCacheOnly = useCallback(() => {
    showModal({
      title: t('settings.clearCache.title'),
      message: t('settings.clearCache.confirmMessage'),
      type: 'info',
      actions: [
        {
          label: t('settings.clearCache.confirmAction'),
          variant: 'primary',
          onClick: () => window.api?.clearCacheOnly(),
        },
      ],
    });
  }, [showModal]);

  const handleClearAllData = useCallback(() => {
    showModal({
      title: t('settings.clearAll.title'),
      message: t('settings.clearAll.confirmMessage'),
      type: 'error',
      actions: [
        {
          label: t('settings.clearAll.confirmAction'),
          variant: 'danger',
          onClick: () => window.api?.clearAllData(),
        },
      ],
    });
  }, [showModal]);

  const handleOpenLogsFolder = useCallback(async () => {
    if (isOpeningLogsFolder) {
      return;
    }
    try {
      const result = await runOpenLogsFolder(() => window.loggerAPI.openLogsFolder(), {
        isSuccess: (r) => r.success,
      });
      if (!result.success) {
        console.error('[Settings] Opening logs folder failed:', result.error);
      }
    } catch (error) {
      console.error('[Settings] Opening logs folder failed:', error);
    }
  }, [isOpeningLogsFolder, runOpenLogsFolder]);

  const handleUnlockTranslation = useCallback(async () => {
    const translationId = unhideTranslationInputRef.current?.value;
    if (!translationId || isUnlockingTranslation) {
      return;
    }
    try {
      const success = await runUnlockTranslation(
        () => window.electronAPI.setGameVisibility(translationId, false),
        { isSuccess: (ok) => ok }
      );
      if (success && unhideTranslationInputRef.current) {
        unhideTranslationInputRef.current.value = '';
      }
    } catch (error) {
      console.error('[Settings] Unlocking hidden translation failed:', error);
    }
  }, [isUnlockingTranslation, runUnlockTranslation]);

  const handleOpenTermsModal = useCallback(() => {
    setIsTermsModalOpen(true);
  }, []);

  const handleCloseTermsModal = useCallback(() => {
    setIsTermsModalOpen(false);
  }, []);

  const handleOpenPrivacyModal = useCallback(() => {
    setIsPrivacyModalOpen(true);
  }, []);

  const handleOpenChangelogModal = useCallback(() => {
    useChangelogStore.getState().openModal();
  }, []);

  const handleClosePrivacyModal = useCallback(() => {
    setIsPrivacyModalOpen(false);
  }, []);

  const handleOpenSendLogsModal = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent button click from triggering parent button
    setIsSendLogsModalOpen(true);
  }, []);

  const handleCloseSendLogsModal = useCallback(() => {
    setIsSendLogsModalOpen(false);
  }, []);

  return (
    <>
      <Modal
        isOpen={isSettingsModalOpen}
        onClose={closeSettingsModal}
        title={t('settings.title')}
        footer={
          <button
            onClick={closeSettingsModal}
            data-gamepad-cancel
            className="w-full px-6 py-3 rounded-xl bg-linear-to-r/srgb from-color-accent to-color-main text-text-dark font-semibold hover:opacity-90 transition-opacity"
          >
            {t('settings.close')}
          </button>
        }
      >
        <div className="space-y-4">
          {/* Feedback link */}
          <a
            href="https://t.me/lbk_launcher_bot"
            target="_blank"
            rel="noopener noreferrer"
            data-gamepad-modal-item
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-glass border border-border hover:bg-glass-hover hover:border-border-hover transition-all duration-300"
          >
            <div className="w-10 h-10 rounded-lg bg-linear-to-br/srgb from-[#0088cc] to-[#00aaff] flex items-center justify-center shrink-0">
              <MessageCircleIcon size={20} color="#ffffff" />
            </div>
            <div className="flex-1 text-left">
              <h4 className="text-sm font-semibold text-text-main">
                {t('settings.feedback.title')}
              </h4>
              <p className="text-xs text-text-muted">
                {t('settings.feedback.description')}
              </p>
            </div>
          </a>

          <SettingItem
            id="performance-mode"
            title={t('settings.performance.title')}
            description={
              isHardwareWeak
                ? t('settings.performance.weakHardware')
                : t('settings.performance.description')
            }
            enabled={!animationsEnabled}
            onChange={toggleAnimations}
            disabled={isHardwareWeak}
          />

          {/* Liquid Glass setting - only show on macOS 26+ */}
          {isLiquidGlassSupported && (
            <SettingItem
              id="liquid-glass"
              title={t('settings.liquidGlass.title')}
              description={
                isHardwareWeak
                  ? t('settings.liquidGlass.weakHardware')
                  : t('settings.liquidGlass.description')
              }
              enabled={liquidGlassEnabled}
              onChange={handleToggleLiquidGlass}
              disabled={isHardwareWeak}
            />
          )}
          <SettingItem
            id="backup"
            title={t('settings.backup.title')}
            description={t('settings.backup.description')}
            enabled={createBackupBeforeInstall}
            onChange={toggleCreateBackup}
          />
          <SettingItem
            id="steam-cef-debugging"
            title={t('settings.steamCef.title')}
            description={t('settings.steamCef.description')}
            enabled={steamCefDebuggingEnabled}
            onChange={handleToggleSteamCefDebugging}
            disabled={isTogglingSteamCef}
          />
          <SteamBridgeStatusCard isOpen={isSettingsModalOpen} />
          <SettingItem
            id="steam-custom-artwork"
            title={t('settings.steamArtwork.title')}
            description={t('settings.steamArtwork.description')}
            enabled={steamCustomArtworkEnabled}
            onChange={handleToggleSteamCustomArtwork}
            disabled={isTogglingSteamArtwork}
          />

          <SettingItem
            id="adult-games"
            title={t('settings.adultGames.title')}
            description={t('settings.adultGames.description')}
            enabled={showAdultGames}
            onChange={toggleShowAdultGames}
          />
          <SettingItem
            id="ai-translations"
            title={t('settings.aiTranslations.title')}
            description={t('settings.aiTranslations.description')}
            enabled={hideAiTranslations}
            onChange={toggleHideAiTranslations}
          />
          <SettingItem
            id="recommendations"
            title={t('settings.recommendations.title')}
            description={t('settings.recommendations.description')}
            enabled={showRecommendations}
            onChange={() => {
              trackEvent('Toggle recommendations', { Enabled: !showRecommendations });
              toggleRecommendations();
            }}
          />
          <SettingItem
            id="notification-sounds"
            title={t('settings.notificationSounds.title')}
            description={t('settings.notificationSounds.description')}
            enabled={notificationSoundsEnabled}
            onChange={toggleNotificationSounds}
          />

          <SettingItem
            id="gamepad-sounds"
            title={t('settings.gamepadSounds.title')}
            description={t('settings.gamepadSounds.description')}
            enabled={gamepadSoundsEnabled}
            onChange={toggleGamepadSounds}
          />

          <SettingItem
            id="product-analytics"
            title={t('settings.productAnalytics.title')}
            description={t('settings.productAnalytics.description')}
            enabled={productAnalyticsEnabled}
            onChange={toggleProductAnalytics}
          />

          <SettingItem
            id="localization-analytics"
            title={t('settings.localizationAnalytics.title')}
            description={t('settings.localizationAnalytics.description')}
            enabled={localizationAnalyticsEnabled}
            onChange={toggleLocalizationAnalytics}
          />

          <SettingItem
            id="crash-diagnostics"
            title={t('settings.crashDiagnostics.title')}
            description={t('settings.crashDiagnostics.description')}
            enabled={crashDiagnosticsEnabled}
            onChange={toggleCrashDiagnostics}
          />

          {/* Steam collection sync */}
          <button
            onClick={handleSyncSteamCollection}
            aria-busy={isSyncingSteamCollection}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-glass border border-border hover:bg-glass-hover hover:border-border-hover transition-all duration-300 aria-busy:opacity-60 aria-busy:cursor-wait"
          >
            <div className="w-10 h-10 rounded-lg bg-linear-to-br/srgb from-color-main to-color-mixed flex items-center justify-center shrink-0">
              <AppActionIcon
                phase={steamCollectionPhase}
                icon={Library}
                size={20}
                className="text-text-dark"
                inheritColor
              />
            </div>
            <div className="flex-1 text-left">
              <h4 className="text-sm font-semibold text-text-main">
                {t('settings.collection.title')}
              </h4>
              <p className="text-xs text-text-muted">
                {t('settings.collection.description')}
              </p>
            </div>
          </button>

          {/* Kurin sync */}
          <button
            onClick={handleKurinSync}
            aria-busy={isSyncingKurin}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-glass border border-border hover:bg-glass-hover hover:border-border-hover transition-all duration-300 aria-busy:opacity-60 aria-busy:cursor-wait"
          >
            <div className="w-10 h-10 rounded-lg bg-color-main flex items-center justify-center shrink-0">
              <AppActionIcon
                phase={kurinSyncPhase}
                icon={RefreshCw}
                size={20}
                className="text-text-dark"
                inheritColor
              />
            </div>
            <div className="flex-1 text-left">
              <h4 className="text-sm font-semibold text-text-main">
                {t('settings.kurin.title')}
              </h4>
              <p className="text-xs text-text-muted">{t('settings.kurin.description')}</p>
            </div>
          </button>

          {/* Add LBK Launcher itself as a non-Steam shortcut */}
          <button
            onClick={handleAddLbkToSteamLibrary}
            aria-busy={isTogglingLbkShortcut}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-glass border border-border hover:bg-glass-hover hover:border-border-hover transition-all duration-300 aria-busy:opacity-60 aria-busy:cursor-wait"
          >
            <div className="w-10 h-10 rounded-lg bg-linear-to-br/srgb from-color-accent to-color-main flex items-center justify-center shrink-0">
              <AppActionIcon
                phase={lbkShortcutPhase}
                icon={Gamepad}
                size={20}
                className="text-text-dark"
                inheritColor
              />
            </div>
            <div className="flex-1 text-left">
              <h4 className="text-sm font-semibold text-text-main">
                {t('settings.lbkShortcut.title')}
              </h4>
              <p className="text-xs text-text-muted">
                {t('settings.lbkShortcut.description')}
              </p>
            </div>
          </button>

          {/* Clear cache only */}
          <button
            onClick={handleClearCacheOnly}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-glass border border-border hover:bg-glass-hover hover:border-border-hover transition-all duration-300"
          >
            <div className="w-10 h-10 rounded-lg bg-color-mixed flex items-center justify-center shrink-0">
              <BrushCleaningIcon size={20} className="text-text-dark" />
            </div>
            <div className="flex-1 text-left">
              <h4 className="text-sm font-semibold text-text-main">
                {t('settings.clearCache.title')}
              </h4>
              <p className="text-xs text-text-muted">
                {t('settings.clearCache.description')}
              </p>
            </div>
          </button>

          {/* Clear all data */}
          <button
            onClick={handleClearAllData}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-glass border border-border hover:bg-glass-hover hover:border-red-500/50 transition-all duration-300"
          >
            <div className="w-10 h-10 rounded-lg bg-color-accent flex items-center justify-center shrink-0">
              <Trash2Icon size={20} className="text-text-dark" />
            </div>
            <div className="flex-1 text-left">
              <h4 className="text-sm font-semibold text-text-main">
                {t('settings.clearAll.title')}
              </h4>
              <p className="text-xs text-text-muted">
                {t('settings.clearAll.description')}
              </p>
            </div>
          </button>

          {/* Sound preview section - only in dev mode */}
          {import.meta.env.DEV && (
            <div className="p-4 rounded-xl bg-glass border border-border">
              <div className="flex items-center gap-2 mb-3">
                <Settings2Icon size={18} className="text-color-accent" />
                <h4 className="text-sm font-semibold text-text-main">
                  {t('settings.dev.title')}
                </h4>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-text-muted mb-2">
                    {t('settings.dev.notificationSounds')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      {
                        type: 'status-change' as const,
                        label: t('settings.dev.soundStatus'),
                        color: 'from-green-500 to-green-600',
                      },
                      {
                        type: 'version-update' as const,
                        label: t('settings.dev.soundVersion'),
                        color: 'from-color-accent to-color-main',
                      },
                      {
                        type: 'app-update' as const,
                        label: t('settings.dev.soundApp'),
                        color: 'from-color-main to-color-mixed',
                      },
                      {
                        type: 'progress-change' as const,
                        label: t('settings.dev.soundProgress'),
                        color: 'from-amber-500 to-orange-500',
                      },
                      {
                        type: 'team-new-game' as const,
                        label: t('settings.dev.soundNewGame'),
                        color: 'from-yellow-500 to-yellow-600',
                      },
                      {
                        type: 'team-status-change' as const,
                        label: t('settings.dev.soundTeam'),
                        color: 'from-cyan-500 to-cyan-600',
                      },
                    ].map(({ type, label, color }) => (
                      <button
                        key={type}
                        onClick={() => playNotificationSound(type)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-linear-to-r/srgb ${color} text-white text-xs font-medium hover:opacity-90 transition-opacity`}
                      >
                        <PlayIcon size={12} />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-text-muted mb-2">
                    {t('settings.dev.gamepadSounds')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => playNavigateSound({ ignoreSettings: true })}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-linear-to-r/srgb from-gray-500 to-gray-600 text-white text-xs font-medium hover:opacity-90 transition-opacity"
                    >
                      <PlayIcon size={12} />
                      {t('settings.dev.navigate')}
                    </button>
                    <button
                      onClick={() => playConfirmSound({ ignoreSettings: true })}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-linear-to-r/srgb from-green-500 to-green-600 text-white text-xs font-medium hover:opacity-90 transition-opacity"
                    >
                      <PlayIcon size={12} />
                      {t('settings.dev.confirm')}
                    </button>
                    <button
                      onClick={() => playBackSound({ ignoreSettings: true })}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-linear-to-r/srgb from-red-500 to-red-600 text-white text-xs font-medium hover:opacity-90 transition-opacity"
                    >
                      <PlayIcon size={12} />
                      {t('settings.dev.back')}
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-text-muted mb-2">
                    {t('settings.dev.promoMode')}
                  </p>
                  <SelectDropdown
                    options={[
                      { name: t('settings.dev.promoNormal'), value: 'normal' },
                      { name: t('settings.dev.promoAlways'), value: 'always' },
                      { name: t('settings.dev.promoNever'), value: 'never' },
                    ]}
                    selectedValue={devMode}
                    onSelectionChange={(value) => setDevMode(value as DevModeType)}
                    placeholder={t('settings.dev.promoPlaceholder')}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Logging */}
          <button
            onClick={handleOpenLogsFolder}
            aria-busy={isOpeningLogsFolder}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-glass border border-border hover:bg-glass-hover hover:border-border-hover transition-all duration-300 aria-busy:opacity-60 aria-busy:cursor-wait"
          >
            <div className="w-10 h-10 rounded-lg bg-linear-to-br/srgb from-yellow-500 to-orange-500 flex items-center justify-center shrink-0">
              <AppActionIcon
                phase={logsFolderPhase}
                icon={FolderOpen}
                size={20}
                className="text-white"
                inheritColor
              />
            </div>
            <div className="flex-1 text-left">
              <h4 className="text-sm font-semibold text-text-main">
                {t('settings.logs.title')}
              </h4>
              <p className="text-xs text-text-muted">{t('settings.logs.description')}</p>
            </div>
            <Button
              onClick={handleOpenSendLogsModal}
              variant="secondary"
              className="shrink-0 border-color-accent! text-color-accent!"
            >
              {t('settings.logs.send')}
            </Button>
          </button>

          <div className="flex flex-col gap-2 p-4 rounded-xl bg-glass border border-border">
            <h4 className="text-sm font-semibold text-text-main">
              {t('settings.unlock.title')}
            </h4>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={t('settings.unlock.placeholder')}
                className={`flex-1 bg-glass border border-border rounded-lg px-3 py-2 text-sm text-text-main focus:outline-hidden focus:border-color-accent transition-colors duration-200 ${
                  unlockPhase === 'done'
                    ? 'border-color-main!'
                    : unlockPhase === 'error'
                      ? 'border-red-400!'
                      : ''
                }`}
                ref={unhideTranslationInputRef}
              />
              <Button
                onClick={handleUnlockTranslation}
                aria-busy={isUnlockingTranslation}
                variant="secondary"
                className="shrink-0 aria-busy:opacity-60 aria-busy:cursor-wait"
                icon={<AppActionIcon phase={unlockPhase} icon={LockOpen} size={16} />}
              >
                {t('settings.unlock.action')}
              </Button>
            </div>
          </div>

          <button
            onClick={handleOpenChangelogModal}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-glass border border-border hover:bg-glass-hover hover:border-border-hover transition-all duration-300"
          >
            <div className="w-10 h-10 rounded-lg bg-linear-to-br/srgb from-color-main to-color-accent flex items-center justify-center shrink-0">
              <SparklesIcon size={20} className="text-white" />
            </div>
            <div className="flex-1 text-left">
              <h4 className="text-sm font-semibold text-text-main">
                {t('settings.changelog.title')}
              </h4>
              <p className="text-xs text-text-muted">
                {t('settings.changelog.description', { version: APP_VERSION })}
              </p>
            </div>
          </button>

          {/* Legal section */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleOpenTermsModal}
              className="flex items-center gap-3 p-4 rounded-xl bg-glass border border-border hover:bg-glass-hover hover:border-border-hover transition-all duration-300"
            >
              <div className="w-10 h-10 rounded-lg bg-linear-to-br/srgb from-color-accent to-color-main flex items-center justify-center shrink-0">
                <FileTextIcon size={20} className="text-white" />
              </div>
              <div className="flex-1 text-left">
                <h4 className="text-sm font-semibold text-text-main">
                  {t('settings.legal.terms')}
                </h4>
              </div>
            </button>

            <button
              onClick={handleOpenPrivacyModal}
              className="flex items-center gap-3 p-4 rounded-xl bg-glass border border-border hover:bg-glass-hover hover:border-border-hover transition-all duration-300"
            >
              <div className="w-10 h-10 rounded-lg bg-linear-to-br/srgb from-blue-500 to-blue-600 flex items-center justify-center shrink-0">
                <ShieldIcon size={20} className="text-white" />
              </div>
              <div className="flex-1 text-left">
                <h4 className="text-sm font-semibold text-text-main">
                  {t('settings.legal.privacy')}
                </h4>
              </div>
            </button>
          </div>

          {/* Credits section */}
          <div
            className="p-4 rounded-xl border credits-section"
            style={{
              background:
                'linear-gradient(to right, rgba(236, 72, 153, 0.2), rgba(168, 85, 247, 0.2))',
              borderColor: 'rgba(236, 72, 153, 0.5)',
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <HeartIcon size={18} className="text-pink-500" />
              <h4 className="text-sm font-semibold text-pink-500">
                {t('settings.credits.title')}
              </h4>
            </div>
            <p className="text-xs text-text-muted mb-3">
              {t('settings.credits.description')}
            </p>
            <div className="flex flex-wrap gap-2">
              {SPECIAL_TRANSLATORS.map((translator) => (
                <span
                  key={translator.name}
                  className="px-3 py-1.5 text-xs font-medium rounded-full border text-purple-400 border-purple-500/50"
                  style={{ background: 'rgba(168, 85, 247, 0.25)' }}
                >
                  {translator.name}
                  {translator.team && (
                    <span className="text-purple-300 ml-1">({translator.team})</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Modal>
      {/* Legal modals */}
      <TermsOfServiceModal isOpen={isTermsModalOpen} onClose={handleCloseTermsModal} />
      <PrivacyPolicyModal isOpen={isPrivacyModalOpen} onClose={handleClosePrivacyModal} />
      {/* Send logs modal */}
      <SendLogsModal isOpen={isSendLogsModalOpen} onClose={handleCloseSendLogsModal} />
    </>
  );
};
