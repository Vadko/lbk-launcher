import React, { useState, useEffect, useCallback } from 'react';
import { MessageCircle, RefreshCw, FolderOpen, Trash2, Heart, Volume2, Play } from 'lucide-react';
import { Modal } from '../Modal/Modal';
import { Switch } from '../ui/Switch';
import { useSettingsStore } from '../../store/useSettingsStore';
import { SPECIAL_TRANSLATORS } from '../../constants/specialTranslators';
import { playNotificationSound } from '../../utils/notificationSounds';
import { playNavigateSound, playConfirmSound, playBackSound } from '../../utils/gamepadSounds';

const SettingItem = React.memo<{
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  onChange: () => void;
}>(({ id, title, description, enabled, onChange }) => (
  <div className="flex items-center justify-between p-4 rounded-xl bg-glass border border-border">
    <div className="flex-1 pr-4">
      <h4 className="text-sm font-semibold text-text-main mb-1">{title}</h4>
      <p className="text-xs text-text-muted">{description}</p>
    </div>
    <Switch id={`switch-${id}`} checked={enabled} onCheckedChange={onChange} />
  </div>
));

SettingItem.displayName = 'SettingItem';

export const SettingsModal: React.FC = () => {
  const isSettingsModalOpen = useSettingsStore((state) => state.isSettingsModalOpen);
  const closeSettingsModal = useSettingsStore((state) => state.closeSettingsModal);
  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const animationsEnabled = useSettingsStore((state) => state.animationsEnabled);
  const toggleAnimations = useSettingsStore((state) => state.toggleAnimations);
  const createBackupBeforeInstall = useSettingsStore(
    (state) => state.createBackupBeforeInstall
  );
  const toggleCreateBackup = useSettingsStore((state) => state.toggleCreateBackup);
  const autoDetectInstalledGames = useSettingsStore(
    (state) => state.autoDetectInstalledGames
  );
  const toggleAutoDetectInstalledGames = useSettingsStore(
    (state) => state.toggleAutoDetectInstalledGames
  );
  const showAdultGames = useSettingsStore((state) => state.showAdultGames);
  const toggleShowAdultGames = useSettingsStore((state) => state.toggleShowAdultGames);
  const liquidGlassEnabled = useSettingsStore((state) => state.liquidGlassEnabled);
  const toggleLiquidGlass = useSettingsStore((state) => state.toggleLiquidGlass);
  // Logging settings
  const saveLogsToFile = useSettingsStore((state) => state.saveLogsToFile);
  const toggleSaveLogsToFile = useSettingsStore((state) => state.toggleSaveLogsToFile);
  // Sound settings
  const notificationSoundsEnabled = useSettingsStore((state) => state.notificationSoundsEnabled);
  const toggleNotificationSounds = useSettingsStore((state) => state.toggleNotificationSounds);
  const gamepadSoundsEnabled = useSettingsStore((state) => state.gamepadSoundsEnabled);
  const toggleGamepadSounds = useSettingsStore((state) => state.toggleGamepadSounds);

  // Check if liquid glass is supported
  const [isLiquidGlassSupported, setIsLiquidGlassSupported] = useState(false);

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

  const handleOpenFeedback = useCallback(() => {
    window.electronAPI?.openExternal('https://t.me/lb_launcher_bot');
  }, []);

  const handleClearCacheOnly = useCallback(async () => {
    await window.api?.clearCacheOnly();
  }, []);

  const handleClearAllData = useCallback(async () => {
    await window.api?.clearAllData();
  }, []);

  const handleToggleSaveLogsToFile = useCallback(async () => {
    const newValue = !saveLogsToFile;
    toggleSaveLogsToFile();
    await window.loggerAPI?.setEnabled(newValue);
  }, [saveLogsToFile, toggleSaveLogsToFile]);

  const handleOpenLogsFolder = useCallback(async () => {
    await window.loggerAPI?.openLogsFolder();
  }, []);

  // Sync logger state when modal opens
  useEffect(() => {
    if (isSettingsModalOpen) {
      window.loggerAPI?.setEnabled(saveLogsToFile);
    }
  }, [isSettingsModalOpen, saveLogsToFile]);

  return (
    <Modal
      isOpen={isSettingsModalOpen}
      onClose={closeSettingsModal}
      title="Налаштування"
      footer={
        <button
          onClick={closeSettingsModal}
          data-gamepad-cancel
          className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-neon-blue to-neon-purple text-white font-semibold hover:opacity-90 transition-opacity"
        >
          Закрити
        </button>
      }
    >
      <div className="space-y-4">
        {/* Feedback link */}
        <button
          onClick={handleOpenFeedback}
          className="w-full flex items-center gap-3 p-4 rounded-xl bg-glass border border-border hover:bg-glass-hover hover:border-border-hover transition-all duration-300"
        >
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#0088cc] to-[#00aaff] flex items-center justify-center flex-shrink-0">
            <MessageCircle size={20} color="#ffffff" />
          </div>
          <div className="flex-1 text-left">
            <h4 className="text-sm font-semibold text-text-main">Зворотний зв'язок</h4>
            <p className="text-xs text-text-muted">Написати нам у Telegram</p>
          </div>
        </button>

        {/* Theme selector */}
        <div className="p-4 rounded-xl bg-glass border border-border">
          <h4 className="text-sm font-semibold text-text-main mb-3">Тема</h4>
          <div className="flex gap-2">
            <button
              onClick={() => setTheme('light')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                theme === 'light'
                  ? 'bg-gradient-to-r from-neon-blue to-neon-purple text-white'
                  : 'bg-glass border border-border text-text-muted hover:text-text-main hover:border-border-hover'
              }`}
            >
              Світла
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                theme === 'dark'
                  ? 'bg-gradient-to-r from-neon-blue to-neon-purple text-white'
                  : 'bg-glass border border-border text-text-muted hover:text-text-main hover:border-border-hover'
              }`}
            >
              Темна
            </button>
            <button
              onClick={() => setTheme('system')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                theme === 'system'
                  ? 'bg-gradient-to-r from-neon-blue to-neon-purple text-white'
                  : 'bg-glass border border-border text-text-muted hover:text-text-main hover:border-border-hover'
              }`}
            >
              Системна
            </button>
          </div>
        </div>

        <SettingItem
          id="animations"
          title="Анімації"
          description="Увімкнути або вимкнути анімації в інтерфейсі"
          enabled={animationsEnabled}
          onChange={toggleAnimations}
        />

        {/* Liquid Glass setting - only show on macOS 26+ */}
        {isLiquidGlassSupported && (
          <SettingItem
            id="liquid-glass"
            title="Liquid Glass тема"
            description="Увімкнути ефект прозорості та розмиття для вікон (macOS 26+)"
            enabled={liquidGlassEnabled}
            onChange={handleToggleLiquidGlass}
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
          id="auto-detect"
          title="Автоматичне виявлення встановлених ігор"
          description="Автоматично виявляти встановлені на вашому комп'ютері ігри"
          enabled={autoDetectInstalledGames}
          onChange={toggleAutoDetectInstalledGames}
        />
        <SettingItem
          id="adult-games"
          title="Показувати ігри з порнографічним вмістом"
          description="Дозволити відображення ігор з порнографічним/еротичним контентом (hentai, візуальні новели для дорослих тощо)"
          enabled={showAdultGames}
          onChange={toggleShowAdultGames}
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

        {/* Clear cache only */}
        <button
          onClick={handleClearCacheOnly}
          className="w-full flex items-center gap-3 p-4 rounded-xl bg-glass border border-border hover:bg-glass-hover hover:border-border-hover transition-all duration-300"
        >
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center flex-shrink-0">
            <RefreshCw size={20} className="text-white" />
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
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center flex-shrink-0">
            <Trash2 size={20} className="text-white" />
          </div>
          <div className="flex-1 text-left">
            <h4 className="text-sm font-semibold text-text-main">
              Очистити всі дані
            </h4>
            <p className="text-xs text-text-muted">
              Видалити налаштування, підписки та всі дані
            </p>
          </div>
        </button>

        {/* Sound preview section - only in dev mode */}
        {import.meta.env.DEV && (
          <div className="p-4 rounded-xl bg-glass border border-border">
            <div className="flex items-center gap-2 mb-3">
              <Volume2 size={18} className="text-neon-blue" />
              <h4 className="text-sm font-semibold text-text-main">Тест звуків (Dev)</h4>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-text-muted mb-2">Звуки сповіщень:</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { type: 'status-change' as const, label: 'Стан', color: 'from-green-500 to-green-600' },
                    { type: 'version-update' as const, label: 'Версія', color: 'from-neon-blue to-neon-purple' },
                    { type: 'app-update' as const, label: 'Застосунок', color: 'from-neon-purple to-pink-500' },
                    { type: 'progress-change' as const, label: 'Прогрес', color: 'from-amber-500 to-orange-500' },
                    { type: 'team-new-game' as const, label: 'Нова гра', color: 'from-yellow-500 to-yellow-600' },
                    { type: 'team-status-change' as const, label: 'Команда', color: 'from-cyan-500 to-cyan-600' },
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
                    onClick={playNavigateSound}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-gray-500 to-gray-600 text-white text-xs font-medium hover:opacity-90 transition-opacity"
                  >
                    <Play size={12} />
                    Навігація
                  </button>
                  <button
                    onClick={playConfirmSound}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-green-500 to-green-600 text-white text-xs font-medium hover:opacity-90 transition-opacity"
                  >
                    <Play size={12} />
                    Підтвердити
                  </button>
                  <button
                    onClick={playBackSound}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-red-500 to-red-600 text-white text-xs font-medium hover:opacity-90 transition-opacity"
                  >
                    <Play size={12} />
                    Назад
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Logging settings */}
        <SettingItem
          id="save-logs"
          title="Зберігати логи"
          description="Записувати всі логи у файл для діагностики"
          enabled={saveLogsToFile}
          onChange={handleToggleSaveLogsToFile}
        />
        {saveLogsToFile && (
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
          </button>
        )}

        {/* Credits section */}
        <div className="p-4 rounded-xl border credits-section" style={{ background: 'linear-gradient(to right, rgba(236, 72, 153, 0.2), rgba(168, 85, 247, 0.2))', borderColor: 'rgba(236, 72, 153, 0.5)' }}>
          <div className="flex items-center gap-2 mb-3">
            <Heart size={18} className="text-pink-500" />
            <h4 className="text-sm font-semibold text-pink-500">Подяки</h4>
          </div>
          <p className="text-xs text-text-muted mb-3">
            Особлива подяка перекладачам, які долучились до тестування з перших днів і допомогають робити цей лаунчер таким, яким він є:
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
  );
};
