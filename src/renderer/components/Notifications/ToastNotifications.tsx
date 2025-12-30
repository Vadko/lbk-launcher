import React, { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RefreshCw, Languages, Download, TrendingUp } from 'lucide-react';
import { useSubscriptionsStore, type ToastNotification } from '../../store/useSubscriptionsStore';
import { useStore } from '../../store/useStore';

const getToastIcon = (type: ToastNotification['type']) => {
  switch (type) {
    case 'status-change':
      return <Languages size={20} className="text-white" />;
    case 'version-update':
      return <RefreshCw size={20} className="text-white" />;
    case 'app-update':
      return <Download size={20} className="text-white" />;
    case 'progress-change':
      return <TrendingUp size={20} className="text-white" />;
    default:
      return <RefreshCw size={20} className="text-white" />;
  }
};

const getToastGradient = (type: ToastNotification['type']) => {
  switch (type) {
    case 'status-change':
      return 'from-green-500 to-green-600';
    case 'version-update':
      return 'from-neon-blue to-neon-purple';
    case 'app-update':
      return 'from-neon-purple to-pink-500';
    case 'progress-change':
      return 'from-amber-500 to-orange-500';
    default:
      return 'from-neon-blue to-neon-purple';
  }
};

const getToastBorder = (type: ToastNotification['type']) => {
  switch (type) {
    case 'status-change':
      return 'border-green-500';
    case 'version-update':
      return 'border-neon-blue';
    case 'app-update':
      return 'border-neon-purple';
    case 'progress-change':
      return 'border-amber-500';
    default:
      return 'border-neon-blue';
  }
};

const getToastTitle = (type: ToastNotification['type']) => {
  switch (type) {
    case 'status-change':
      return 'Зміна стану';
    case 'version-update':
      return 'Доступне оновлення';
    case 'app-update':
      return 'Оновлення застосунку';
    case 'progress-change':
      return 'Оновлення прогресу';
    default:
      return 'Сповіщення';
  }
};

export const ToastNotifications: React.FC = () => {
  const toasts = useSubscriptionsStore((state) => state.toasts);
  const dismissToast = useSubscriptionsStore((state) => state.dismissToast);
  const setSelectedGame = useStore((state) => state.setSelectedGame);

  const handleToastClick = useCallback(async (toast: ToastNotification) => {
    // Don't navigate for app-update notifications
    if (toast.type === 'app-update') {
      return;
    }

    // Load game and select it
    try {
      const games = await window.electronAPI.fetchGamesByIds([toast.gameId]);
      if (games.length > 0) {
        setSelectedGame(games[0]);
      }
    } catch (error) {
      console.error('Failed to load game:', error);
    }

    dismissToast(toast.id);
  }, [setSelectedGame, dismissToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-12 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className={`notification-toast border ${getToastBorder(toast.type)} rounded-xl p-4 shadow-lg min-w-[320px] max-w-[400px] pointer-events-auto cursor-pointer hover:scale-[1.02] transition-transform`}
            onClick={() => handleToastClick(toast)}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-lg bg-gradient-to-br ${getToastGradient(toast.type)} flex items-center justify-center flex-shrink-0`}
              >
                {getToastIcon(toast.type)}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-white mb-1">
                  {getToastTitle(toast.type)}
                </h4>
                <p className="text-xs text-text-muted">
                  {toast.gameName} • {toast.message}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dismissToast(toast.id);
                }}
                className="flex-shrink-0 w-6 h-6 rounded-lg hover:bg-glass-hover transition-colors flex items-center justify-center"
              >
                <X size={14} className="text-text-muted" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
