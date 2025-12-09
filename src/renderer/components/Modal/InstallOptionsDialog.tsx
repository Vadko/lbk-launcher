import React, { useState } from 'react';
import { Modal } from './Modal';
import { Volume2, Archive, Shield, Trophy } from 'lucide-react';
import type { Game } from '../../../shared/types';

interface InstallOptionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options: { createBackup: boolean; installVoice: boolean; installAchievements: boolean }) => void;
  game: Game;
  defaultCreateBackup: boolean;
}

export const InstallOptionsDialog: React.FC<InstallOptionsDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  game,
  defaultCreateBackup,
}) => {
  const [createBackup, setCreateBackup] = useState(defaultCreateBackup);
  const [installVoice, setInstallVoice] = useState(true);
  const [installAchievements, setInstallAchievements] = useState(true);

  // Перевіряємо чи гра для Steam
  const isSteamGame = game.platforms?.includes('steam');
  const hasAchievements = isSteamGame && game.achievements_archive_path;

  const handleConfirm = () => {
    onConfirm({ createBackup, installVoice, installAchievements: hasAchievements ? installAchievements : false });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Опції встановлення">
      <div className="flex flex-col gap-6">
        <p className="text-text-muted">
          Виберіть опції для встановлення українізатора "{game.name}":
        </p>

        {/* Backup option */}
        <label className="flex items-start gap-4 cursor-pointer group">
          <div className="relative flex items-center justify-center mt-0.5">
            <input
              type="checkbox"
              checked={createBackup}
              onChange={(e) => setCreateBackup(e.target.checked)}
              className="appearance-none w-5 h-5 rounded-md bg-glass border border-border checked:bg-gradient-to-r checked:from-neon-blue checked:to-neon-purple transition-colors cursor-pointer"
            />
            <svg
              className={`absolute w-3 h-3 text-white pointer-events-none transition-opacity ${
                createBackup ? 'opacity-100' : 'opacity-0'
              }`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Shield size={18} className="text-neon-blue" />
              <span className="font-medium text-white group-hover:text-neon-blue transition-colors">
                Створити резервну копію
              </span>
            </div>
            <p className="text-sm text-text-muted mt-1">
              Зберегти оригінальні файли гри. Рекомендовано для можливості відновлення.
            </p>
          </div>
        </label>

        {/* Voice archive option */}
        <label className="flex items-start gap-4 cursor-pointer group">
          <div className="relative flex items-center justify-center mt-0.5">
            <input
              type="checkbox"
              checked={installVoice}
              onChange={(e) => setInstallVoice(e.target.checked)}
              className="appearance-none w-5 h-5 rounded-md bg-glass border border-border checked:bg-gradient-to-r checked:from-neon-blue checked:to-neon-purple transition-colors cursor-pointer"
            />
            <svg
              className={`absolute w-3 h-3 text-white pointer-events-none transition-opacity ${
                installVoice ? 'opacity-100' : 'opacity-0'
              }`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Volume2 size={18} className="text-purple-400" />
              <span className="font-medium text-white group-hover:text-purple-400 transition-colors">
                Встановити озвучку
              </span>
            </div>
            <div className="text-sm text-text-muted mt-1">
              <p>Додати українську озвучку до українізатора.</p>
              {game.voice_archive_size && (
                <p className="flex items-center gap-1 mt-1 text-purple-400">
                  <Archive size={14} />
                  <span>Розмір: {game.voice_archive_size}</span>
                </p>
              )}
            </div>
          </div>
        </label>

        {/* Achievements archive option - Steam only */}
        {hasAchievements && (
          <label className="flex items-start gap-4 cursor-pointer group">
            <div className="relative flex items-center justify-center mt-0.5">
              <input
                type="checkbox"
                checked={installAchievements}
                onChange={(e) => setInstallAchievements(e.target.checked)}
                className="appearance-none w-5 h-5 rounded-md bg-glass border border-border checked:bg-gradient-to-r checked:from-neon-blue checked:to-neon-purple transition-colors cursor-pointer"
              />
              <svg
                className={`absolute w-3 h-3 text-white pointer-events-none transition-opacity ${
                  installAchievements ? 'opacity-100' : 'opacity-0'
                }`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Trophy size={18} className="text-green-400" />
                <span className="font-medium text-white group-hover:text-green-400 transition-colors">
                  Встановити ачівки
                </span>
              </div>
              <div className="text-sm text-text-muted mt-1">
                <p>Додати переклад досягнень Steam.</p>
                {game.achievements_archive_size && (
                  <p className="flex items-center gap-1 mt-1 text-green-400">
                    <Archive size={14} />
                    <span>Розмір: {game.achievements_archive_size}</span>
                  </p>
                )}
              </div>
            </div>
          </label>
        )}

        {/* Total size info */}
        <div className="bg-glass rounded-xl p-4 border border-border">
          <div className="flex items-center gap-2 text-sm">
            <Archive size={16} className="text-text-muted" />
            <span className="text-text-muted">Буде завантажено:</span>
            <span className="text-white font-medium">
              {calculateTotalSize(
                game.archive_size,
                installVoice ? game.voice_archive_size : null,
                hasAchievements && installAchievements ? game.achievements_archive_size : null
              )}
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 rounded-xl bg-glass border border-border text-white font-semibold hover:bg-glass-hover transition-colors"
          >
            Скасувати
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-neon-blue to-neon-purple text-white font-semibold hover:opacity-90 transition-opacity"
          >
            Встановити
          </button>
        </div>
      </div>
    </Modal>
  );
};

/**
 * Calculate total size from size strings like "150.00 MB" and "50.00 MB"
 */
function calculateTotalSize(
  textSize: string | null,
  voiceSize: string | null,
  achievementsSize: string | null
): string {
  const sizes = [textSize, voiceSize, achievementsSize].filter(Boolean) as string[];
  if (sizes.length === 0) return 'N/A';
  if (sizes.length === 1) return sizes[0];

  const parseSize = (sizeStr: string): number => {
    const match = sizeStr.trim().match(/([\d.]+)\s*(B|KB|MB|GB)/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();

    const multipliers: Record<string, number> = {
      'B': 1,
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024,
    };

    return value * (multipliers[unit] || 0);
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const totalBytes = sizes.reduce((sum, size) => sum + parseSize(size), 0);
  return formatSize(totalBytes);
}
