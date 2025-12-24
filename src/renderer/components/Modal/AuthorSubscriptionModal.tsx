import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from './Modal';
import { Users, Bell, Star } from 'lucide-react';
import { useSubscriptionsStore } from '../../store/useSubscriptionsStore';
import { getSpecialTranslatorInfo } from '../../constants/specialTranslators';
import { Tooltip } from '../ui/Tooltip';

interface AuthorSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameName: string;
  team: string;
}

/**
 * Modal that prompts users to subscribe to game authors
 * Shows when user opens a game for the first time
 */
export const AuthorSubscriptionModal: React.FC<AuthorSubscriptionModalProps> = ({
  isOpen,
  onClose,
  gameName,
  team,
}) => {
  const { subscribeToTeam, isSubscribedToTeam } = useSubscriptionsStore();

  // Parse authors from comma-separated team string
  const authors = useMemo(() => {
    if (!team) return [];
    return team
      .split(',')
      .map((a) => a.trim())
      .filter((a) => a.length > 0);
  }, [team]);

  // Track selected authors (all selected by default, except already subscribed)
  const [selectedAuthors, setSelectedAuthors] = useState<Set<string>>(new Set());

  // Initialize selection when modal opens
  /* eslint-disable react-hooks/set-state-in-effect -- intentional reset on prop change */
  useEffect(() => {
    if (isOpen && authors.length > 0) {
      // Select all authors that user is not already subscribed to
      const initialSelection = new Set(
        authors.filter((author) => !isSubscribedToTeam(author))
      );
      setSelectedAuthors(initialSelection);
    }
  }, [isOpen, authors, isSubscribedToTeam]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Count how many authors are not yet subscribed
  const unsubscribedCount = useMemo(() => authors.filter((author) => !isSubscribedToTeam(author)).length, [authors, isSubscribedToTeam]);

  const toggleAuthor = (author: string) => {
    setSelectedAuthors((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(author)) {
        newSet.delete(author);
      } else {
        newSet.add(author);
      }
      return newSet;
    });
  };

  const handleSubscribe = () => {
    selectedAuthors.forEach((author) => {
      subscribeToTeam(author);
    });
    onClose();
  };

  const handleSkip = () => {
    onClose();
  };

  // Don't show if all authors are already subscribed
  if (unsubscribedCount === 0) {
    return null;
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Слідкувати за авторами">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-neon-blue/20 flex items-center justify-center">
            <Users size={24} className="text-neon-blue" />
          </div>
          <div>
            <p className="text-text-main font-medium">{gameName}</p>
            <p className="text-sm text-text-muted">
              {authors.length === 1
                ? 'Автор локалізації'
                : `${authors.length} автори локалізації`}
            </p>
          </div>
        </div>

        {/* Description */}
        <p className="text-text-muted">
          Хочете отримувати сповіщення про нові локалізації від{' '}
          {authors.length === 1 ? 'цього автора' : 'цих авторів'}? Ви зможете
          змінити підписки в будь-який момент.
        </p>

        {/* Authors list */}
        <div className="space-y-2">
          {authors.map((author) => {
            const isAlreadySubscribed = isSubscribedToTeam(author);
            const isSelected = selectedAuthors.has(author);
            const specialInfo = getSpecialTranslatorInfo(author);
            const isSpecial = specialInfo !== null;

            return (
              <label
                key={author}
                className={`flex items-center gap-4 p-3 rounded-xl border transition-all cursor-pointer ${
                  isAlreadySubscribed
                    ? 'bg-green-500/10 border-green-500/30 cursor-default'
                    : isSelected
                      ? 'bg-glass border-neon-blue/50 hover:border-neon-blue'
                      : 'bg-glass border-border hover:border-border-hover'
                }`}
              >
                <div className="relative flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={isAlreadySubscribed || isSelected}
                    disabled={isAlreadySubscribed}
                    onChange={() => !isAlreadySubscribed && toggleAuthor(author)}
                    data-gamepad-modal-item
                    className={`appearance-none w-5 h-5 rounded-md bg-glass border border-border checked:bg-neon-purple checked:border-neon-purple transition-colors focus:ring-2 focus:ring-neon-purple/50 focus:outline-none ${
                      isAlreadySubscribed ? 'cursor-default' : 'cursor-pointer'
                    }`}
                  />
                  <svg
                    className={`absolute w-3 h-3 text-white pointer-events-none transition-opacity ${
                      isAlreadySubscribed || isSelected ? 'opacity-100' : 'opacity-0'
                    }`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-medium truncate ${
                        isSpecial ? 'text-yellow-400' : 'text-text-main'
                      }`}
                    >
                      {author}
                    </span>
                    {isSpecial && specialInfo && (
                      <Tooltip content={specialInfo.description}>
                        <Star size={14} className="text-yellow-400 fill-yellow-400 cursor-help flex-shrink-0" />
                      </Tooltip>
                    )}
                    {isAlreadySubscribed && (
                      <span className="flex items-center gap-1 text-xs text-green-400 flex-shrink-0">
                        <Bell size={12} />
                        підписано
                      </span>
                    )}
                  </div>
                </div>
              </label>
            );
          })}
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleSkip}
            data-gamepad-cancel
            data-gamepad-modal-item
            className="flex-1 px-6 py-3 rounded-xl bg-glass border border-border text-text-main font-semibold hover:bg-glass-hover transition-colors"
          >
            Пропустити
          </button>
          <button
            onClick={handleSubscribe}
            disabled={selectedAuthors.size === 0}
            data-gamepad-confirm
            data-gamepad-modal-item
            className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-opacity flex items-center justify-center gap-2 ${
              selectedAuthors.size === 0
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-neon-blue to-neon-purple text-white hover:opacity-90'
            }`}
          >
            <Bell size={18} />
            {selectedAuthors.size > 0
              ? `Підписатись (${selectedAuthors.size})`
              : 'Підписатись'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
