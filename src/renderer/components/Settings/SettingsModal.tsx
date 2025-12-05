import React from 'react';
import { Modal } from '../Modal/Modal';
import { useSettingsStore } from '../../store/useSettingsStore';

export const SettingsModal: React.FC = () => {
  const {
    isSettingsModalOpen,
    closeSettingsModal,
    animationsEnabled,
    toggleAnimations,
    appUpdateNotificationsEnabled,
    toggleAppUpdateNotifications,
    gameUpdateNotificationsEnabled,
    toggleGameUpdateNotifications,
    createBackupBeforeInstall,
    toggleCreateBackup,
    autoDetectInstalledGames,
    toggleAutoDetectInstalledGames,
    showAdultGames,
    toggleShowAdultGames,
  } = useSettingsStore();

  const ToggleSwitch: React.FC<{ enabled: boolean; onClick: () => void }> = ({ enabled, onClick }) => (
    <button
      onClick={onClick}
      className={`relative flex-shrink-0 w-14 h-8 rounded-full transition-colors ${
        enabled ? 'bg-gradient-to-r from-neon-blue to-neon-purple' : 'bg-glass border border-border'
      }`}
    >
      <div
        className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-0'
        }`}
      />
    </button>
  );

  const SettingItem: React.FC<{ title: string; description: string; enabled: boolean; onClick: () => void }> = ({
    title,
    description,
    enabled,
    onClick,
  }) => (
    <div className="flex items-center justify-between p-4 rounded-xl bg-glass border border-border">
      <div className="flex-1 pr-4">
        <h4 className="text-sm font-semibold text-white mb-1">{title}</h4>
        <p className="text-xs text-text-muted">{description}</p>
      </div>
      <ToggleSwitch enabled={enabled} onClick={onClick} />
    </div>
  );

  return (
    <Modal isOpen={isSettingsModalOpen} onClose={closeSettingsModal} title="Налаштування">
      <div className="space-y-4">
        <SettingItem
          title="Анімації"
          description="Увімкнути або вимкнути анімації в інтерфейсі"
          enabled={animationsEnabled}
          onClick={toggleAnimations}
        />
        <SettingItem
          title="Сповіщення про оновлення додатку"
          description="Показувати сповіщення про нові версії додатку"
          enabled={appUpdateNotificationsEnabled}
          onClick={toggleAppUpdateNotifications}
        />
        <SettingItem
          title="Сповіщення про оновлення ігор"
          description="Показувати сповіщення про нові версії перекладів"
          enabled={gameUpdateNotificationsEnabled}
          onClick={toggleGameUpdateNotifications}
        />
        <SettingItem
          title="Створювати резервну копію"
          description="Зберігати оригінальні файли гри перед встановленням перекладу"
          enabled={createBackupBeforeInstall}
          onClick={toggleCreateBackup}
        />
        <SettingItem
          title="Автоматична перевірка встановлених ігор"
          description="Автоматично визначати встановлені ігри на вашому комп'ютері"
          enabled={autoDetectInstalledGames}
          onClick={toggleAutoDetectInstalledGames}
        />
        <SettingItem
          title="Показувати 18+ ігри"
          description="Дозволити відображення ігор з контентом для дорослих"
          enabled={showAdultGames}
          onClick={toggleShowAdultGames}
        />

        {/* Close button */}
        <button
          onClick={closeSettingsModal}
          className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-neon-blue to-neon-purple text-white font-semibold hover:opacity-90 transition-opacity"
        >
          Закрити
        </button>
      </div>
    </Modal>
  );
};
