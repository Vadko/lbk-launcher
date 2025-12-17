import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Bell,
  Trash2,
  CheckCircle,
  RefreshCw,
  Languages,
  Settings,
  Download,
  ChevronLeft,
  TrendingUp,
} from 'lucide-react';
import { Modal } from '../Modal/Modal';
import { Button } from '../ui/Button';
import { Switch } from '../ui/Switch';
import { useSubscriptionsStore, Notification } from '../../store/useSubscriptionsStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useStore } from '../../store/useStore';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  const {
    notifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    clearNotification,
    clearAllNotifications,
  } = useSubscriptionsStore();

  const { setSelectedGame } = useStore();

  const appUpdateNotificationsEnabled = useSettingsStore(
    (state) => state.appUpdateNotificationsEnabled
  );
  const toggleAppUpdateNotifications = useSettingsStore(
    (state) => state.toggleAppUpdateNotifications
  );
  const gameUpdateNotificationsEnabled = useSettingsStore(
    (state) => state.gameUpdateNotificationsEnabled
  );
  const toggleGameUpdateNotifications = useSettingsStore(
    (state) => state.toggleGameUpdateNotifications
  );

  const handleNotificationClick = async (notification: Notification) => {
    // Позначити як прочитане
    markNotificationAsRead(notification.id);

    // Для app-update нотифікацій не переходимо на гру
    if (notification.type === 'app-update') {
      return;
    }

    // Завантажити гру та вибрати її
    try {
      const games = await window.electronAPI.fetchGamesByIds([notification.gameId]);
      if (games.length > 0) {
        setSelectedGame(games[0]);
        onClose();
      }
    } catch (error) {
      console.error('Failed to load game:', error);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Щойно';
    if (minutes < 60) return `${minutes} хв тому`;
    if (hours < 24) return `${hours} год тому`;
    if (days < 7) return `${days} дн тому`;

    return date.toLocaleDateString('uk-UA');
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'status-change':
        return <Languages className="w-4 h-4 text-green-400" />;
      case 'version-update':
        return <RefreshCw className="w-4 h-4 text-neon-blue" />;
      case 'app-update':
        return <Download className="w-4 h-4 text-neon-purple" />;
      case 'progress-change':
        return <TrendingUp className="w-4 h-4 text-amber-400" />;
      default:
        return <Bell className="w-4 h-4 text-neon-blue" />;
    }
  };

  const getNotificationIconBg = (type: Notification['type']) => {
    switch (type) {
      case 'status-change':
        return 'bg-green-500/20';
      case 'version-update':
        return 'bg-neon-blue/20';
      case 'app-update':
        return 'bg-neon-purple/20';
      case 'progress-change':
        return 'bg-amber-500/20';
      default:
        return 'bg-neon-blue/20';
    }
  };

  const getNotificationText = (notification: Notification) => {
    switch (notification.type) {
      case 'status-change':
        return (
          <>
            Статус змінено з "{notification.oldValue}" на "{notification.newValue}"
          </>
        );
      case 'version-update':
        return (
          <>
            Оновлення версії з {notification.oldValue} до {notification.newValue}
          </>
        );
      case 'app-update':
        return <>Доступна нова версія додатку: {notification.newValue}</>;
      case 'progress-change':
        return <>{notification.newValue}</>;
      default:
        return <>Нове сповіщення</>;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" showCloseButton={false}>
      <div className="p-6 max-w-2xl w-full relative">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {showSettings ? (
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 hover:bg-glass rounded-lg transition-colors"
              >
                <ChevronLeft className="w-6 h-6 text-neon-blue" />
              </button>
            ) : (
              <Bell className="w-6 h-6 text-neon-blue" />
            )}
            <h2 className="text-2xl font-bold text-white">
              {showSettings ? 'Налаштування сповіщень' : 'Сповіщення'}
            </h2>
            {!showSettings && notifications.filter((n) => !n.read).length > 0 && (
              <span className="px-2 py-1 bg-neon-blue text-bg-dark text-xs font-bold rounded-full">
                {notifications.filter((n) => !n.read).length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!showSettings && (
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 hover:bg-glass rounded-lg transition-colors"
                title="Налаштування сповіщень"
              >
                <Settings className="w-5 h-5 text-text-muted" />
              </button>
            )}
            <button
              onClick={onClose}
              data-gamepad-cancel
              className="p-2 hover:bg-glass rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-text-muted" />
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {showSettings ? (
            <motion.div
              key="settings"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="space-y-4 min-h-[400px]"
            >
              <div className="flex items-center justify-between p-4 rounded-xl bg-glass border border-border">
                <div className="flex-1 pr-4">
                  <h4 className="text-sm font-semibold text-white mb-1">
                    Оновлення додатку
                  </h4>
                  <p className="text-xs text-text-muted">
                    Сповіщення про нові версії LB Launcher
                  </p>
                </div>
                <Switch
                  id="switch-app-updates"
                  checked={appUpdateNotificationsEnabled}
                  onCheckedChange={toggleAppUpdateNotifications}
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-glass border border-border">
                <div className="flex-1 pr-4">
                  <h4 className="text-sm font-semibold text-white mb-1">
                    Оновлення українізаторів
                  </h4>
                  <p className="text-xs text-text-muted">
                    Сповіщення про нові версії встановлених українізаторів
                  </p>
                </div>
                <Switch
                  id="switch-game-updates"
                  checked={gameUpdateNotificationsEnabled}
                  onCheckedChange={toggleGameUpdateNotifications}
                />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="notifications"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="min-h-[400px]"
            >
              {notifications.length === 0 ? (
                <div className="text-center py-12">
                  <Bell className="w-16 h-16 text-text-muted mx-auto mb-4 opacity-30" />
                  <p className="text-text-muted">Сповіщень немає</p>
                  <p className="text-sm text-text-muted mt-2">
                    Підпишіться на українізатори зі статусом "Заплановано",
                    <br />
                    щоб отримувати сповіщення про зміни статусу
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex justify-between mb-4">
                    <Button
                      variant="glass"
                      onClick={markAllNotificationsAsRead}
                      disabled={notifications.filter((n) => !n.read).length === 0}
                      className="text-sm px-4 py-2"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Прочитати всі
                    </Button>
                    <Button
                      variant="glass"
                      onClick={() => setShowConfirmClear(true)}
                      className="text-sm px-4 py-2"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Очистити всі
                    </Button>
                  </div>

                  <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                          notification.read
                            ? 'notification-item bg-glass border-border opacity-70 hover:opacity-100'
                            : 'notification-item-unread bg-glass-hover border-neon-blue/30 hover:bg-glass'
                        }`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`p-2 rounded-lg flex-shrink-0 ${getNotificationIconBg(notification.type)}`}
                          >
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {!notification.read && (
                                <span className="w-2 h-2 bg-neon-blue rounded-full animate-pulse flex-shrink-0" />
                              )}
                              <h3 className="font-semibold text-white truncate">
                                {notification.gameName}
                              </h3>
                            </div>
                            <p className="text-sm text-text-muted">
                              {getNotificationText(notification)}
                            </p>
                            <p className="text-xs text-text-muted mt-1">
                              {formatTimestamp(notification.timestamp)}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              clearNotification(notification.id);
                            }}
                            className="p-1 hover:bg-glass rounded transition-colors flex-shrink-0"
                          >
                            <X className="w-4 h-4 text-text-muted" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Confirm Clear Modal */}
        <AnimatePresence>
          {showConfirmClear && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm rounded-2xl flex items-center justify-center z-10"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="bg-bg-dark border border-border rounded-xl p-6 mx-4 max-w-sm w-full"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-red-500/20">
                    <Trash2 className="w-5 h-5 text-red-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">
                    Видалити всі сповіщення?
                  </h3>
                </div>
                <p className="text-sm text-text-muted mb-6">
                  Цю дію неможливо скасувати. Всі сповіщення будуть видалені назавжди.
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="glass"
                    onClick={() => setShowConfirmClear(false)}
                    data-gamepad-cancel
                    className="flex-1"
                  >
                    Скасувати
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => {
                      clearAllNotifications();
                      setShowConfirmClear(false);
                    }}
                    data-gamepad-confirm
                    className="flex-1 !bg-red-500 hover:!bg-red-600"
                  >
                    Видалити
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  );
};
