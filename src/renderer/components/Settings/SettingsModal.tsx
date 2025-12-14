import React, { useState, useEffect, useCallback } from 'react';
import { MessageCircle, RefreshCw, FolderOpen } from 'lucide-react';
import { Modal } from '../Modal/Modal';
import { Switch } from '../ui/Switch';
import { useSettingsStore } from '../../store/useSettingsStore';

const SettingItem = React.memo<{
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  onChange: () => void;
}>(({ id, title, description, enabled, onChange }) => (
  <div className="flex items-center justify-between p-4 rounded-xl bg-glass border border-border">
    <div className="flex-1 pr-4">
      <h4 className="text-sm font-semibold text-white mb-1">{title}</h4>
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

  const handleClearCacheAndRestart = useCallback(async () => {
    await window.windowControls?.clearCacheAndRestart();
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
            <MessageCircle size={20} className="text-white" />
          </div>
          <div className="flex-1 text-left">
            <h4 className="text-sm font-semibold text-white">Зворотній зв'язок</h4>
            <p className="text-xs text-text-muted">Написати нам у Telegram</p>
          </div>
        </button>

        {/* Theme selector */}
        <div className="p-4 rounded-xl bg-glass border border-border">
          <h4 className="text-sm font-semibold text-white mb-3">Тема</h4>
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
          title="Автоматична перевірка встановлених ігор"
          description="Автоматично визначати встановлені ігри на вашому комп'ютері"
          enabled={autoDetectInstalledGames}
          onChange={toggleAutoDetectInstalledGames}
        />
        <SettingItem
          id="adult-games"
          title="Показувати ігри з порно контентом"
          description="Дозволити відображення ігор з порнографічним/еротичним контентом (hentai, візуальні новели для дорослих тощо)"
          enabled={showAdultGames}
          onChange={toggleShowAdultGames}
        />

        {/* Clear cache and restart */}
        <button
          onClick={handleClearCacheAndRestart}
          className="w-full flex items-center gap-3 p-4 rounded-xl bg-glass border border-border hover:bg-glass-hover hover:border-border-hover transition-all duration-300"
        >
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center flex-shrink-0">
            <RefreshCw size={20} className="text-white" />
          </div>
          <div className="flex-1 text-left">
            <h4 className="text-sm font-semibold text-white">
              Очистити кеш і перезапустити
            </h4>
            <p className="text-xs text-text-muted">
              Видалити тимчасові дані та перезавантажити додаток
            </p>
          </div>
        </button>

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
              <h4 className="text-sm font-semibold text-white">
                Відкрити папку з логами
              </h4>
              <p className="text-xs text-text-muted">Переглянути збережені файли логів</p>
            </div>
          </button>
        )}
      </div>
    </Modal>
  );
};
