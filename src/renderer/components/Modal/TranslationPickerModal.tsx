import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Users } from 'lucide-react';
import type { Game } from '../../types/game';
import { useStore } from '../../store/useStore';
import { useGamepadModeStore } from '../../store/useGamepadModeStore';
import { getGameImageUrl } from '../../utils/imageUrl';

interface TranslationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  translations: Game[];
  gameName: string;
}

export const TranslationPickerModal: React.FC<TranslationPickerModalProps> = ({
  isOpen,
  onClose,
  translations,
  gameName,
}) => {
  const { selectedGame, setSelectedGame, installedGames, gamesWithUpdates } = useStore();
  const { isGamepadMode, setNavigationArea } = useGamepadModeStore();

  const handleSelect = (game: Game) => {
    setSelectedGame(game);
    onClose();
    // Switch to main content after selection in gamepad mode
    if (isGamepadMode) {
      setTimeout(() => setNavigationArea('main-content'), 50);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={onClose}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />

          {/* Modal */}
          <motion.div
            role="dialog"
            aria-modal="true"
            className="relative bg-[rgba(10,20,30,0.95)] border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 backdrop-blur-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <h3 className="text-base font-semibold text-text-main">
                  Оберіть переклад
                </h3>
                <p className="text-sm text-text-muted truncate">{gameName}</p>
              </div>
              <button
                onClick={onClose}
                data-gamepad-cancel
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-glass-hover transition-colors"
              >
                <X size={18} className="text-text-muted" />
              </button>
            </div>

            {/* Translations list */}
            <div className="p-2 max-h-[60vh] overflow-y-auto">
              {translations.map((game, index) => {
                const isSelected = selectedGame?.id === game.id;
                const isInstalled = installedGames.has(game.id);
                const hasUpdate = gamesWithUpdates.has(game.id);
                const progress = game.translation_progress ?? 0;
                const logoUrl = getGameImageUrl(game.logo_path);

                return (
                  <button
                    key={game.id}
                    onClick={() => handleSelect(game)}
                    data-gamepad-modal-item
                    data-gamepad-confirm={index === 0 ? true : undefined}
                    className={`
                      w-full p-3 rounded-xl mb-1 last:mb-0 text-left transition-all
                      flex items-center gap-3 group
                      ${isSelected
                        ? 'bg-neon-blue/20 ring-1 ring-neon-blue'
                        : 'hover:bg-glass-hover focus:bg-glass-hover focus:ring-1 focus:ring-neon-blue/50'
                      }
                    `}
                  >
                    {/* Team logo */}
                    <div className="relative w-12 h-12 flex-shrink-0 rounded-xl overflow-hidden bg-glass">
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt={game.team || 'Team logo'}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div className={`absolute inset-0 flex items-center justify-center ${logoUrl ? 'hidden' : ''}`}>
                        <Users size={20} className="text-text-muted" />
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-text-main truncate">
                          {game.team || 'Невідомий автор'}
                        </span>
                        {isInstalled && (
                          <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium bg-green-500/20 text-green-400 rounded">
                            Встановлено
                          </span>
                        )}
                        {hasUpdate && (
                          <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium bg-neon-blue/20 text-neon-blue rounded">
                            Оновлення
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
                        <span className={progress >= 100 ? 'text-green-400' : 'text-neon-blue'}>
                          {progress}%
                        </span>
                        {game.version && <span>v{game.version}</span>}
                        {game.status && (
                          <span className={
                            game.status === 'completed' ? 'text-green-400' :
                            game.status === 'in-progress' ? 'text-neon-blue' :
                            ''
                          }>
                            {game.status === 'completed' ? 'Завершено' :
                             game.status === 'in-progress' ? 'Ранній доступ' :
                             game.status === 'planned' ? 'Заплановано' : game.status}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Selected indicator */}
                    {isSelected && (
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-neon-blue flex items-center justify-center">
                        <Check size={14} className="text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Footer hint */}
            <div className="p-3 border-t border-border text-center text-xs text-text-muted">
              <span className="inline-flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 bg-glass rounded text-[10px]">A</kbd>
                Обрати
                <span className="mx-1">•</span>
                <kbd className="px-1.5 py-0.5 bg-glass rounded text-[10px]">B</kbd>
                Закрити
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
