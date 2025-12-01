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

  return (
    <Modal isOpen={isSettingsModalOpen} onClose={closeSettingsModal} title="Налаштування">
      <div className="space-y-4">
        {/* Animations Toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-glass border border-border">
          <div className="flex-1 pr-4">
            <h4 className="text-sm font-semibold text-white mb-1">Анімації</h4>
            <p className="text-xs text-text-muted">
              Увімкнути або вимкнути анімації в інтерфейсі
            </p>
          </div>
          <ToggleSwitch enabled={animationsEnabled} onClick={toggleAnimations} />
        </div>

        {/* App Update Notifications */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-glass border border-border">
          <div className="flex-1 pr-4">
            <h4 className="text-sm font-semibold text-white mb-1">Сповіщення про оновлення додатку</h4>
            <p className="text-xs text-text-muted">
              Показувати сповіщення про нові версії додатку
            </p>
          </div>
          <ToggleSwitch enabled={appUpdateNotificationsEnabled} onClick={toggleAppUpdateNotifications} />
        </div>

        {/* Game Update Notifications */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-glass border border-border">
          <div className="flex-1 pr-4">
            <h4 className="text-sm font-semibold text-white mb-1">Сповіщення про оновлення ігор</h4>
            <p className="text-xs text-text-muted">
              Показувати сповіщення про нові версії перекладів
            </p>
          </div>
          <ToggleSwitch enabled={gameUpdateNotificationsEnabled} onClick={toggleGameUpdateNotifications} />
        </div>

        {/* Create Backup Before Install */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-glass border border-border">
          <div className="flex-1 pr-4">
            <h4 className="text-sm font-semibold text-white mb-1">Створювати резервну копію</h4>
            <p className="text-xs text-text-muted">
              Зберігати оригінальні файли гри перед встановленням перекладу
            </p>
          </div>
          <ToggleSwitch enabled={createBackupBeforeInstall} onClick={toggleCreateBackup} />
        </div>

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
