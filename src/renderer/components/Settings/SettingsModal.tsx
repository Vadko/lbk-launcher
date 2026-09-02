import {
  BrushCleaning,
  FileText,
  FolderOpen,
  Heart,
  Library,
  MessageCircle,
  Play,
  RefreshCw,
  Settings2,
  Shield,
  Sparkles,
  Trash2,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useModalStore } from '@/renderer/store/useModalStore';
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

function steamCollectionSyncErrorMessage(
  reason:
    | 'cef-unavailable'
    | 'steam-not-running'
    | 'no-translated-games'
    | 'no-matches'
    | 'failed'
): string {
  switch (reason) {
    case 'steam-not-running':
      return 'Steam не запущено. Запустіть Steam і спробуйте ще раз.';
    case 'cef-unavailable':
      return 'Увімкніть налаштування «Швидке застосування параметрів запуску Steam» і перезапустіть Steam, щоб лаунчер міг керувати колекціями.';
    case 'no-translated-games':
      return 'У каталозі поки немає перекладів, доступних через Майстерню Steam.';
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
  const [isTranslationUnlocked, setIsTranslationUnlocked] = useState(false);
  const [isSyncingSteamCollection, setIsSyncingSteamCollection] = useState(false);

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

  const handleToggleSteamCefDebugging = () => {
    const newValue = !steamCefDebuggingEnabled;
    toggleSteamCefDebugging();
    // Fire-and-forget — the enable path can probe Steam for ~1.5s.
    window.electronAPI?.setSteamCefDebugging(newValue).catch(console.error);
  };

  const handleToggleSteamCustomArtwork = () => {
    const newValue = !steamCustomArtworkEnabled;
    toggleSteamCustomArtwork();
    // Fire-and-forget — switching off walks every app we've touched.
    window.electronAPI?.setSteamCustomArtwork(newValue).catch(console.error);
  };

  const handleSyncSteamCollection = useCallback(async () => {
    setIsSyncingSteamCollection(true);
    try {
      const result = await window.electronAPI.syncSteamTranslatedCollection();
      if (result.ok) {
        showModal({
          title: 'Колекція оновлена',
          message:
            result.total === 0
              ? 'У колекції «З українізаторами» тепер немає ігор.'
              : `У колекції «З українізаторами» тепер ${result.total} ${result.total === 1 ? 'гра' : 'ігор'}.`,
          type: 'info',
        });
      } else {
        showModal({
          title: 'Не вдалося оновити колекцію',
          message: steamCollectionSyncErrorMessage(result.reason),
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
    } finally {
      setIsSyncingSteamCollection(false);
    }
  }, [showModal]);

  const handleKurinSync = useCallback(async () => {
    closeSettingsModal();
    const syncedGameNames = await window.electronAPI?.syncKurinGames();
    if (syncedGameNames && syncedGameNames.length > 0) {
      showModal({
        title: 'Синхронізація завершена',
        message: `Синхронізовано ${syncedGameNames.length} ${syncedGameNames.length === 1 ? 'гру' : 'ігор'}: ${syncedGameNames.join(', ')}`,
        type: 'info',
      });
    } else {
      showModal({
        title: 'Синхронізація завершена',
        message: 'Не знайдено ігор, встановлених через Kurin, або Kurin не встановлено.',
        type: 'info',
      });
    }
  }, [showModal, closeSettingsModal]);

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
    await window.loggerAPI?.openLogsFolder();
  }, []);

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
        footer={
          <button
            onClick={closeSettingsModal}
            data-gamepad-cancel
            className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-color-accent to-color-main text-text-dark font-semibold hover:opacity-90 transition-opacity"
          >
            Закрити
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
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#0088cc] to-[#00aaff] flex items-center justify-center flex-shrink-0">
              <MessageCircle size={20} color="#ffffff" />
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
          />
          <SettingItem
            id="steam-custom-artwork"
            title="Українські обкладинки в Steam"
            description="Замінювати банер, логотип і горизонтальну обкладинку гри в бібліотеці Steam на українські версії з українізатора. Вертикальна обкладинка залишається оригінальною. Оригінали повертаються при видаленні українізатора або коли вимкнути цей перемикач"
            enabled={steamCustomArtworkEnabled}
            onChange={handleToggleSteamCustomArtwork}
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
            disabled={isSyncingSteamCollection}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-glass border border-border hover:bg-glass-hover hover:border-border-hover transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-color-main to-color-mixed flex items-center justify-center flex-shrink-0">
              <Library size={20} className="text-text-dark" />
            </div>
            <div className="flex-1 text-left">
              <h4 className="text-sm font-semibold text-text-main">
                Колекція «З українізаторами» в Steam
              </h4>
              <p className="text-xs text-text-muted">
                {isSyncingSteamCollection
                  ? 'Оновлення...'
                  : 'Створити або оновити колекцію бібліотеки Steam з іграми, на які є переклад'}
              </p>
            </div>
          </button>

          {/* Kurin sync */}
          <button
            onClick={handleKurinSync}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-glass border border-border hover:bg-glass-hover hover:border-border-hover transition-all duration-300"
          >
            <div className="w-10 h-10 rounded-lg bg-color-main flex items-center justify-center flex-shrink-0">
              <RefreshCw size={20} className="text-text-dark" />
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

          {/* Clear cache only */}
          <button
            onClick={handleClearCacheOnly}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-glass border border-border hover:bg-glass-hover hover:border-border-hover transition-all duration-300"
          >
            <div className="w-10 h-10 rounded-lg bg-color-mixed flex items-center justify-center flex-shrink-0">
              <BrushCleaning size={20} className="text-text-dark" />
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
            <div className="w-10 h-10 rounded-lg bg-color-accent flex items-center justify-center flex-shrink-0">
              <Trash2 size={20} className="text-text-dark" />
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
                <Settings2 size={18} className="text-color-accent" />
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
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r ${color} text-white text-xs font-medium hover:opacity-90 transition-opacity`}
                      >
                        <Play size={12} />
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
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-gray-500 to-gray-600 text-white text-xs font-medium hover:opacity-90 transition-opacity"
                    >
                      <Play size={12} />
                      Навігація
                    </button>
                    <button
                      onClick={() => playConfirmSound({ ignoreSettings: true })}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-green-500 to-green-600 text-white text-xs font-medium hover:opacity-90 transition-opacity"
                    >
                      <Play size={12} />
                      Підтвердити
                    </button>
                    <button
                      onClick={() => playBackSound({ ignoreSettings: true })}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-red-500 to-red-600 text-white text-xs font-medium hover:opacity-90 transition-opacity"
                    >
                      <Play size={12} />
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
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-glass border border-border hover:bg-glass-hover hover:border-border-hover transition-all duration-300"
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center flex-shrink-0">
              <FolderOpen size={20} className="text-white" />
            </div>
            <div className="flex-1 text-left">
              <h4 className="text-sm font-semibold text-text-main">
                Відкрити папку з логами
              </h4>
              <p className="text-xs text-text-muted">Переглянути збережені файли логів</p>
            </div>
            <Button
              onClick={handleOpenSendLogsModal}
              variant="secondary"
              className="flex-shrink-0 !border-color-accent !text-color-accent"
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
                className={`flex-1 bg-glass border border-border rounded-lg px-3 py-2 text-sm text-text-main focus:outline-none focus:border-color-accent transition-colors duration-300 ${
                  isTranslationUnlocked ? '!border-color-main' : ''
                }`}
                ref={unhideTranslationInputRef}
                onChange={() => setIsTranslationUnlocked(false)}
              />
              <Button
                onClick={async () => {
                  const translationId = unhideTranslationInputRef.current?.value;
                  if (translationId) {
                    const success = await window.electronAPI.setGameVisibility(
                      translationId,
                      false
                    );
                    if (success) {
                      if (unhideTranslationInputRef.current) {
                        unhideTranslationInputRef.current.value = '';
                      }
                      setIsTranslationUnlocked(true);
                    }
                  }
                }}
                variant="secondary"
                className="flex-shrink-0"
              >
                Розблокувати
              </Button>
            </div>
          </div>

          <button
            onClick={handleOpenChangelogModal}
            className="flex items-center gap-3 p-4 rounded-xl bg-glass border border-border hover:bg-glass-hover hover:border-border-hover transition-all duration-300"
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-color-main to-color-accent flex items-center justify-center flex-shrink-0">
              <Sparkles size={20} className="text-white" />
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
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-color-accent to-color-main flex items-center justify-center flex-shrink-0">
                <FileText size={20} className="text-white" />
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
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                <Shield size={20} className="text-white" />
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
              <Heart size={18} className="text-pink-500" />
              <h4 className="text-sm font-semibold text-pink-500">Подяки</h4>
            </div>
            <p className="text-xs text-text-muted mb-3">
              Особлива подяка перекладачам, які долучились до тестування з перших днів і
              допомогають робити цей лаунчер таким, яким він є:
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
