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
import { plural } from '@/shared/plural';
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

function steamActionErrorMessage(
  reason: SteamCollectionSyncFailure,
  purpose: string
): string {
  switch (reason) {
    case 'steam-not-running':
      return 'Steam не запущено. Запустіть Steam і спробуйте ще раз.';
    case 'cef-unavailable':
      return `Увімкніть налаштування «Швидке застосування параметрів запуску Steam» і перезапустіть Steam, щоб лаунчер міг ${purpose}.`;
    case 'library-unavailable':
      return 'Бібліотека Steam ще завантажується. Спробуйте за кілька секунд.';
    case 'no-translated-games':
      return 'У каталозі немає перекладів до ігор Steam. Якщо каталог ще синхронізується, спробуйте за хвилину.';
    case 'no-matches':
      return 'Серед ваших ігор у бібліотеці Steam немає жодної з перекладом.';
    default:
      return 'Спробуйте ще раз пізніше.';
  }
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
          title: 'Колекція оновлена',
          message:
            result.total === 0
              ? 'У колекції «З українізаторами» тепер немає ігор.'
              : `У колекції «З українізаторами» тепер ${result.total} ${plural(result.total, 'гра', 'гри', 'ігор')}.`,
          type: 'info',
        });
      } else {
        showModal({
          title: 'Не вдалося оновити колекцію',
          message: steamActionErrorMessage(result.reason, 'керувати колекціями'),
          type: 'error',
        });
      }
    } catch (error) {
      console.error('[Settings] Steam collection sync failed:', error);
      showModal({
        title: 'Не вдалося оновити колекцію',
        message: 'Сталася непередбачена помилка.',
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
          title: 'Готово',
          message: 'LBK Launcher додано в бібліотеку Steam.',
          type: 'info',
        });
      } else {
        showModal({
          title: 'Не вдалося додати в Steam',
          message: steamActionErrorMessage(result.reason, 'додати ярлик у бібліотеку'),
          type: 'error',
        });
      }
    } catch (error) {
      console.error('[Settings] Adding LBK to Steam library failed:', error);
      showModal({
        title: 'Сталася помилка',
        message: 'Спробуйте ще раз пізніше.',
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
        title: 'Не вдалося синхронізувати',
        message: 'Сталася непередбачена помилка.',
        type: 'error',
      });
      return;
    }
    kurinSyncResultRef.current = syncedGameNames;
  }, [showModal, isSyncingKurin, runKurinSync]);

  const showKurinSyncResult = useCallback((synced: string[]) => {
    useModalStore.getState().showModal({
      title: 'Синхронізація завершена',
      message:
        synced.length > 0
          ? `Синхронізовано ${synced.length} ${plural(synced.length, 'гру', 'гри', 'ігор')}: ${synced.join(', ')}`
          : 'Не знайдено ігор, встановлених через Kurin, або Kurin не встановлено.',
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
      title: 'Очистити кеш',
      message:
        'Буде видалено тимчасові файли та базу даних. Налаштування збережуться. Застосунок перезапуститься.',
      type: 'info',
      actions: [
        {
          label: 'Очистити',
          variant: 'primary',
          onClick: () => window.api?.clearCacheOnly(),
        },
      ],
    });
  }, [showModal]);

  const handleClearAllData = useCallback(() => {
    showModal({
      title: 'Очистити всі дані',
      message:
        'Буде видалено всі дані, включаючи налаштування та підписки. Застосунок перезапуститься.',
      type: 'error',
      actions: [
        {
          label: 'Видалити все',
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
        title="Налаштування"
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
              <h4 className="text-sm font-semibold text-text-main">Зворотний зв'язок</h4>
              <p className="text-xs text-text-muted">Написати нам у Telegram</p>
            </div>
          </a>

          <SettingItem
            id="performance-mode"
            title="Режим продуктивності"
            description={
              isHardwareWeak
                ? 'Увімкнено: на цьому пристрої недостатньо ресурсів для плавних анімацій, тому режим продуктивності не можна вимкнути'
                : 'Вимикає анімації і блюр в інтерфейсі для кращої продуктивності'
            }
            enabled={!animationsEnabled}
            onChange={toggleAnimations}
            disabled={isHardwareWeak}
          />

          {/* Liquid Glass setting - only show on macOS 26+ */}
          {isLiquidGlassSupported && (
            <SettingItem
              id="liquid-glass"
              title="Liquid Glass тема"
              description={
                isHardwareWeak
                  ? 'Вимкнено: на цьому пристрої недостатньо ресурсів для ефекту прозорості'
                  : 'Увімкнути ефект прозорості та розмиття для вікон (macOS 26+)'
              }
              enabled={liquidGlassEnabled}
              onChange={handleToggleLiquidGlass}
              disabled={isHardwareWeak}
            />
          )}
          <SettingItem
            id="backup"
            title="Створювати резервну копію"
            description="Зберігати оригінальні файли гри перед встановленням українізатора"
            enabled={createBackupBeforeInstall}
            onChange={toggleCreateBackup}
          />
          <SettingItem
            id="steam-cef-debugging"
            title="Швидке застосування параметрів запуску Steam"
            description="Створює файл .cef-enable-remote-debugging у теці Steam, щоб застосовувати параметри запуску без перезапуску Steam (після увімкнення потрібен один перезапуск). Якщо вимкнено, файл буде видалено — зверніть увагу: цей самий файл використовує Decky Loader — а параметри запуску оновлюватимуться лише коли Steam закрито"
            enabled={steamCefDebuggingEnabled}
            onChange={handleToggleSteamCefDebugging}
            disabled={isTogglingSteamCef}
          />
          <SettingItem
            id="steam-custom-artwork"
            title="Українські обкладинки в Steam"
            description="Замінювати банер, логотип і горизонтальну обкладинку гри в бібліотеці Steam на українські версії з українізатора. Вертикальна обкладинка залишається оригінальною. Оригінали повертаються при видаленні українізатора або коли вимкнути цей перемикач"
            enabled={steamCustomArtworkEnabled}
            onChange={handleToggleSteamCustomArtwork}
            disabled={isTogglingSteamArtwork}
          />

          <SettingItem
            id="adult-games"
            title="Показувати ігри з порнографічним вмістом"
            description="Дозволити відображення ігор з порнографічним/еротичним контентом (hentai, візуальні новели для дорослих тощо)"
            enabled={showAdultGames}
            onChange={toggleShowAdultGames}
          />
          <SettingItem
            id="ai-translations"
            title="Приховати ШІ-переклади"
            description="Сховати переклади, створені за допомогою штучного інтелекту"
            enabled={hideAiTranslations}
            onChange={toggleHideAiTranslations}
          />
          <SettingItem
            id="recommendations"
            title="Рекомендації ігор"
            description="Показувати блок «Вас може зацікавити» на сторінці гри"
            enabled={showRecommendations}
            onChange={() => {
              trackEvent('Toggle recommendations', { Enabled: !showRecommendations });
              toggleRecommendations();
            }}
          />
          <SettingItem
            id="notification-sounds"
            title="Звуки сповіщень"
            description="Відтворювати звуки при отриманні сповіщень про оновлення"
            enabled={notificationSoundsEnabled}
            onChange={toggleNotificationSounds}
          />

          <SettingItem
            id="gamepad-sounds"
            title="Звуки геймпада"
            description="Відтворювати звуки при навігації геймпадом"
            enabled={gamepadSoundsEnabled}
            onChange={toggleGamepadSounds}
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
                Колекція «З українізаторами» в Steam
              </h4>
              <p className="text-xs text-text-muted">
                Створити або оновити колекцію бібліотеки Steam з іграми, на які є переклад
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
                Синхронізація з Kurin`
              </h4>
              <p className="text-xs text-text-muted">
                Знайти встановлені ігри, додані через Kurin`, та імпортувати їх
              </p>
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
                LBK Launcher в бібліотеці Steam
              </h4>
              <p className="text-xs text-text-muted">Додати лаунчер як гру в Steam</p>
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
              <h4 className="text-sm font-semibold text-text-main">Очистити кеш</h4>
              <p className="text-xs text-text-muted">
                Видалити тимчасові файли (зберігає налаштування)
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
              <h4 className="text-sm font-semibold text-text-main">Очистити всі дані</h4>
              <p className="text-xs text-text-muted">
                Видалити налаштування, підписки та всі дані
              </p>
            </div>
          </button>

          {/* Sound preview section - only in dev mode */}
          {import.meta.env.DEV && (
            <div className="p-4 rounded-xl bg-glass border border-border">
              <div className="flex items-center gap-2 mb-3">
                <Settings2Icon size={18} className="text-color-accent" />
                <h4 className="text-sm font-semibold text-text-main">Dev налаштування</h4>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-text-muted mb-2">Звуки сповіщень:</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      {
                        type: 'status-change' as const,
                        label: 'Стан',
                        color: 'from-green-500 to-green-600',
                      },
                      {
                        type: 'version-update' as const,
                        label: 'Версія',
                        color: 'from-color-accent to-color-main',
                      },
                      {
                        type: 'app-update' as const,
                        label: 'Застосунок',
                        color: 'from-color-main to-color-mixed',
                      },
                      {
                        type: 'progress-change' as const,
                        label: 'Прогрес',
                        color: 'from-amber-500 to-orange-500',
                      },
                      {
                        type: 'team-new-game' as const,
                        label: 'Нова гра',
                        color: 'from-yellow-500 to-yellow-600',
                      },
                      {
                        type: 'team-status-change' as const,
                        label: 'Команда',
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
                  <p className="text-xs text-text-muted mb-2">Звуки геймпада:</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => playNavigateSound({ ignoreSettings: true })}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-linear-to-r/srgb from-gray-500 to-gray-600 text-white text-xs font-medium hover:opacity-90 transition-opacity"
                    >
                      <PlayIcon size={12} />
                      Навігація
                    </button>
                    <button
                      onClick={() => playConfirmSound({ ignoreSettings: true })}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-linear-to-r/srgb from-green-500 to-green-600 text-white text-xs font-medium hover:opacity-90 transition-opacity"
                    >
                      <PlayIcon size={12} />
                      Підтвердити
                    </button>
                    <button
                      onClick={() => playBackSound({ ignoreSettings: true })}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-linear-to-r/srgb from-red-500 to-red-600 text-white text-xs font-medium hover:opacity-90 transition-opacity"
                    >
                      <PlayIcon size={12} />
                      Назад
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-text-muted mb-2">
                    Режим показу промо банера:
                  </p>
                  <SelectDropdown
                    options={[
                      { name: 'Звичайний (24 год + галочка)', value: 'normal' },
                      { name: 'Завжди показувати', value: 'always' },
                      { name: 'Ніколи не показувати', value: 'never' },
                    ]}
                    selectedValue={devMode}
                    onSelectionChange={(value) => setDevMode(value as DevModeType)}
                    placeholder="Оберіть режим"
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
                Відкрити теку з логами
              </h4>
              <p className="text-xs text-text-muted">Переглянути збережені файли логів</p>
            </div>
            <Button
              onClick={handleOpenSendLogsModal}
              variant="secondary"
              className="shrink-0 border-color-accent! text-color-accent!"
            >
              Відправити файл
            </Button>
          </button>

          <div className="flex flex-col gap-2 p-4 rounded-xl bg-glass border border-border">
            <h4 className="text-sm font-semibold text-text-main">
              Розблокувати прихований переклад
            </h4>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Код перекладу"
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
                Розблокувати
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
              <h4 className="text-sm font-semibold text-text-main">Що нового</h4>
              <p className="text-xs text-text-muted">Історія оновлень · v{APP_VERSION}</p>
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
                  Умови використання
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
                  Політика конфіденційності
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
              <h4 className="text-sm font-semibold text-pink-500">Подяки</h4>
            </div>
            <p className="text-xs text-text-muted mb-3">
              Особлива подяка перекладачам, які долучились до тестування з перших днів і
              допомагають робити цей лаунчер таким, яким він є:
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
