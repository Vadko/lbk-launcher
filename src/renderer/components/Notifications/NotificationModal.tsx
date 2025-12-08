import React from 'react';
import { X, History, Trash2, CheckCircle } from 'lucide-react';
import { Modal } from '../Modal/Modal';
import { Button } from '../ui/Button';
import { useSubscriptionsStore } from '../../store/useSubscriptionsStore';
import { useStore } from '../../store/useStore';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({ isOpen, onClose }) => {
  const {
    notifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    clearNotification,
    clearAllNotifications,
  } = useSubscriptionsStore();

  const { setSelectedGame } = useStore();

  const handleNotificationClick = async (notification: any) => {
    // Позначити як прочитане
    markNotificationAsRead(notification.id);

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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" showCloseButton={false}>
      <div className="p-6 max-w-2xl w-full">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <History className="w-6 h-6 text-neon-blue" />
            <h2 className="text-2xl font-bold text-white">Історія оновлень статусу</h2>
            {notifications.filter(n => !n.read).length > 0 && (
              <span className="px-2 py-1 bg-neon-blue text-bg-dark text-xs font-bold rounded-full">
                {notifications.filter(n => !n.read).length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-glass rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-text-muted" />
          </button>
        </div>

        {notifications.length === 0 ? (
          <div className="text-center py-12">
            <History className="w-16 h-16 text-text-muted mx-auto mb-4 opacity-30" />
            <p className="text-text-muted">Історія порожня</p>
            <p className="text-sm text-text-muted mt-2">
              Підпишіться на переклади зі статусом "Заплановано",<br />
              щоб відстежувати зміни їх статусу
            </p>
          </div>
        ) : (
          <>
            <div className="flex justify-between mb-4">
              <Button
                variant="glass"
                onClick={markAllNotificationsAsRead}
                disabled={notifications.filter(n => !n.read).length === 0}
                className="text-sm px-4 py-2"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Прочитати всі
              </Button>
              <Button
                variant="glass"
                onClick={() => {
                  if (confirm('Видалити всі сповіщення?')) {
                    clearAllNotifications();
                  }
                }}
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
                      ? 'bg-glass border-border opacity-70 hover:opacity-100'
                      : 'bg-[rgba(0,242,255,0.1)] border-[rgba(0,242,255,0.3)] hover:bg-[rgba(0,242,255,0.15)]'
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {!notification.read && (
                          <span className="w-2 h-2 bg-neon-blue rounded-full animate-pulse" />
                        )}
                        <h3 className="font-semibold text-white">
                          {notification.gameName}
                        </h3>
                      </div>
                      <p className="text-sm text-text-muted">
                        {notification.type === 'status-change' ? (
                          <>Статус змінено з "{notification.oldValue}" на "{notification.newValue}"</>
                        ) : (
                          <>Оновлення версії з {notification.oldValue} до {notification.newValue}</>
                        )}
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
                      className="p-1 hover:bg-glass rounded transition-colors ml-4"
                    >
                      <X className="w-4 h-4 text-text-muted" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};