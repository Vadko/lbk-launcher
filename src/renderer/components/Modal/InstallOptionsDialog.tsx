import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from './Modal';
import { Volume2, Archive, Shield, Trophy, Check, Trash2, FileText, Info } from 'lucide-react';
import type { Game, InstallationInfo, InstallOptions } from '../../../shared/types';

interface InstallOptionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (
    installOptions: InstallOptions,
    removeOptions: { removeVoice: boolean; removeAchievements: boolean }
  ) => void;
  game: Game;
  defaultCreateBackup: boolean;
  installationInfo?: InstallationInfo;
  isCustomPath?: boolean; // True if installed via custom path (not Steam folder)
}

export const InstallOptionsDialog: React.FC<InstallOptionsDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  game,
  defaultCreateBackup,
  installationInfo,
  isCustomPath,
}) => {
  // Check what's available and what's already installed
  const isSteamGame = game.platforms?.includes('steam');
  // Achievements only available for Steam games installed in Steam folder (not custom path)
  const hasAchievementsArchive = !!(
    isSteamGame &&
    game.achievements_archive_path &&
    !isCustomPath
  );
  const hasVoiceArchive = !!game.voice_archive_path;

  const isVoiceInstalled = installationInfo?.components?.voice?.installed ?? false;
  const isAchievementsInstalled =
    installationInfo?.components?.achievements?.installed ?? false;
  const isReinstall = !!installationInfo;

  // State for checkboxes - initialize based on what's installed or defaults
  const [createBackup, setCreateBackup] = useState(defaultCreateBackup);
  const [installText, setInstallText] = useState(true);
  const [installVoice, setInstallVoice] = useState(true);
  const [installAchievements, setInstallAchievements] = useState(true);

  // Reset state when dialog opens
  /* eslint-disable react-hooks/set-state-in-effect -- intentional reset on prop change */
  useEffect(() => {
    if (isOpen) {
      setCreateBackup(defaultCreateBackup);
      // For reinstall, text is checked by default (to reinstall/update)
      setInstallText(true);
      // Set defaults based on what's already installed
      setInstallVoice(isVoiceInstalled || !isReinstall);
      setInstallAchievements(isAchievementsInstalled || !isReinstall);
    }
  }, [
    isOpen,
    defaultCreateBackup,
    isVoiceInstalled,
    isAchievementsInstalled,
    isReinstall,
  ]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Calculate what will be downloaded/removed
  const willDownloadVoice = hasVoiceArchive && installVoice && !isVoiceInstalled;
  const willDownloadAchievements =
    hasAchievementsArchive && installAchievements && !isAchievementsInstalled;
  const willReinstallAchievements =
    hasAchievementsArchive &&
    installAchievements &&
    isAchievementsInstalled &&
    isReinstall;
  const willRemoveVoice = hasVoiceArchive && !installVoice && isVoiceInstalled;
  const willRemoveAchievements =
    hasAchievementsArchive && !installAchievements && isAchievementsInstalled;

  const handleConfirm = () => {
    onConfirm(
      {
        createBackup,
        installText,
        installVoice: hasVoiceArchive ? installVoice : false,
        installAchievements: hasAchievementsArchive ? installAchievements : false,
      },
      {
        removeVoice: willRemoveVoice,
        removeAchievements: willRemoveAchievements,
      }
    );
    onClose();
  };

  // Compute total download size
  const totalDownloadSize = useMemo(() => {
    const sizes: (string | null)[] = [];

    // Always downloading text if not a reinstall, or if installText is checked
    if (!isReinstall || installText) {
      sizes.push(game.archive_size);
    }

    if (willDownloadVoice) {
      sizes.push(game.voice_archive_size ?? null);
    }

    if (willDownloadAchievements || willReinstallAchievements) {
      sizes.push(game.achievements_archive_size ?? null);
    }

    return calculateTotalSize(sizes.filter(Boolean) as string[]);
  }, [
    game,
    isReinstall,
    installText,
    willDownloadVoice,
    willDownloadAchievements,
    willReinstallAchievements,
  ]);

  // Compute approximate backup size (same as what will be installed)
  const backupSize = useMemo(() => {
    if (isReinstall) return null;

    const sizes: (string | null)[] = [game.archive_size];

    if (installVoice && hasVoiceArchive) {
      sizes.push(game.voice_archive_size ?? null);
    }

    if (installAchievements && hasAchievementsArchive) {
      sizes.push(game.achievements_archive_size ?? null);
    }

    const result = calculateTotalSize(sizes.filter(Boolean) as string[]);
    return result !== 'N/A' ? result : null;
  }, [
    game,
    isReinstall,
    installVoice,
    installAchievements,
    hasVoiceArchive,
    hasAchievementsArchive,
  ]);

  // При новому встановленні - хоча б один компонент має бути вибраний
  // При перевстановленні - будь-яка зміна
  const hasChanges = isReinstall
    ? installText ||
      willDownloadVoice ||
      willDownloadAchievements ||
      willReinstallAchievements ||
      willRemoveVoice ||
      willRemoveAchievements
    : installText ||
      (hasVoiceArchive && installVoice) ||
      (hasAchievementsArchive && installAchievements);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isReinstall ? 'Керування компонентами' : 'Опції встановлення'}
    >
      <div className="flex flex-col gap-6">
        <p className="text-text-muted">
          {isReinstall
            ? `Оберіть компоненти для "${game.name}":`
            : `Виберіть опції для встановлення українізатора "${game.name}":`}
        </p>

        {/* Backup option - only show for new installs */}
        {!isReinstall && (
          <label className="flex items-start gap-4 cursor-pointer group">
            <div className="relative flex items-center justify-center mt-0.5">
              <input
                type="checkbox"
                checked={createBackup}
                onChange={(e) => setCreateBackup(e.target.checked)}
                data-gamepad-modal-item
                className="appearance-none w-5 h-5 rounded-md bg-glass border border-border checked:bg-color-main checked:border-color-main transition-colors cursor-pointer focus:ring-2 focus:ring-color-main/50 focus:outline-none"
              />
              <svg
                className={`absolute w-3 h-3 text-text-dark pointer-events-none transition-opacity ${
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
                <Shield size={18} className="text-color-accent" />
                <span className="font-medium text-text-main group-hover:text-color-accent transition-colors">
                  Створити резервну копію
                </span>
              </div>
              <p className="text-sm text-text-muted mt-1">
                Зберегти оригінальні файли гри. Рекомендовано для можливості відновлення.
              </p>
              {createBackup && backupSize && (
                <p className="flex items-center gap-1 mt-1 text-color-accent text-sm">
                  <Archive size={14} />
                  <span>Орієнтовний розмір: {backupSize}</span>
                </p>
              )}
            </div>
          </label>
        )}

        {/* Text localization */}
        <label className="flex items-start gap-4 cursor-pointer group">
          <div className="relative flex items-center justify-center mt-0.5">
            <input
              type="checkbox"
              checked={installText}
              onChange={(e) => setInstallText(e.target.checked)}
              data-gamepad-modal-item
              className="appearance-none w-5 h-5 rounded-md bg-glass border border-border checked:bg-color-main checked:border-color-main transition-colors cursor-pointer focus:ring-2 focus:ring-color-main/50 focus:outline-none"
            />
            <svg
              className={`absolute w-3 h-3 text-text-dark pointer-events-none transition-opacity ${
                installText ? 'opacity-100' : 'opacity-0'
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
              <FileText size={18} className="text-color-accent" />
              <span className="font-medium text-text-main group-hover:text-color-accent transition-colors">
                Текстова локалізація
              </span>
              {isReinstall && (
                <span className="flex items-center gap-1 text-xs text-green-400">
                  <Check size={12} />
                  встановлено
                </span>
              )}
            </div>
            <div className="text-sm text-text-muted mt-1">
              <p>Переклад текстів гри українською.</p>
              {game.archive_size && (
                <p className="flex items-center gap-1 mt-1 text-color-accent">
                  <Archive size={14} />
                  <span>Розмір: {game.archive_size}</span>
                </p>
              )}
              {isReinstall && installText && (
                <p className="flex items-center gap-1 mt-1 text-green-400">
                  <Archive size={14} />
                  <span>Буде перевстановлено</span>
                </p>
              )}
              {!isReinstall && installText && (
                <p className="flex items-center gap-1 mt-1 text-green-400">
                  <Archive size={14} />
                  <span>Буде встановлено</span>
                </p>
              )}
            </div>
          </div>
        </label>

        {/* Voice archive option */}
        <label
          className={`flex items-start gap-4 group ${hasVoiceArchive ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
        >
          <div className="relative flex items-center justify-center mt-0.5">
            <input
              type="checkbox"
              checked={hasVoiceArchive && installVoice}
              onChange={(e) => setInstallVoice(e.target.checked)}
              disabled={!hasVoiceArchive}
              data-gamepad-modal-item
              className={`appearance-none w-5 h-5 rounded-md bg-glass border border-border checked:bg-color-main checked:border-color-main transition-colors focus:ring-2 focus:ring-color-main/50 focus:outline-none ${hasVoiceArchive ? 'cursor-pointer' : 'cursor-not-allowed'}`}
            />
            <svg
              className={`absolute w-3 h-3 text-text-dark pointer-events-none transition-opacity ${
                hasVoiceArchive && installVoice ? 'opacity-100' : 'opacity-0'
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
              <Volume2
                size={18}
                className={hasVoiceArchive ? 'text-purple-400' : 'text-text-muted'}
              />
              <span
                className={`font-medium transition-colors ${hasVoiceArchive ? 'text-text-main group-hover:text-purple-400' : 'text-text-muted'}`}
              >
                Озвучення
              </span>
              {!hasVoiceArchive && (
                <span className="text-xs text-text-muted">(недоступно)</span>
              )}
              {isVoiceInstalled && (
                <span className="flex items-center gap-1 text-xs text-green-400">
                  <Check size={12} />
                  встановлено
                </span>
              )}
            </div>
            <div className="text-sm text-text-muted mt-1">
              <p>Українське озвучення.</p>
              {game.voice_archive_size && (
                <p className="flex items-center gap-1 mt-1 text-purple-400">
                  <Archive size={14} />
                  <span>Розмір: {game.voice_archive_size}</span>
                </p>
              )}
              {willRemoveVoice && (
                <p className="flex items-center gap-1 mt-1 text-red-400">
                  <Trash2 size={14} />
                  <span>Буде видалено</span>
                </p>
              )}
              {willDownloadVoice && (
                <p className="flex items-center gap-1 mt-1 text-green-400">
                  <Archive size={14} />
                  <span>Буде завантажено</span>
                </p>
              )}
            </div>
          </div>
        </label>

        {/* Achievements archive option - Steam only */}
        {isSteamGame && (
          <label
            className={`flex items-start gap-4 group ${hasAchievementsArchive ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
          >
            <div className="relative flex items-center justify-center mt-0.5">
              <input
                type="checkbox"
                checked={hasAchievementsArchive && installAchievements}
                onChange={(e) => setInstallAchievements(e.target.checked)}
                disabled={!hasAchievementsArchive}
                data-gamepad-modal-item
                className={`appearance-none w-5 h-5 rounded-md bg-glass border border-border checked:bg-color-main checked:border-color-main transition-colors focus:ring-2 focus:ring-color-main/50 focus:outline-none ${hasAchievementsArchive ? 'cursor-pointer' : 'cursor-not-allowed'}`}
              />
              <svg
                className={`absolute w-3 h-3 text-text-dark pointer-events-none transition-opacity ${
                  hasAchievementsArchive && installAchievements
                    ? 'opacity-100'
                    : 'opacity-0'
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
                <Trophy
                  size={18}
                  className={
                    hasAchievementsArchive ? 'text-green-400' : 'text-text-muted'
                  }
                />
                <span
                  className={`font-medium transition-colors ${hasAchievementsArchive ? 'text-text-main group-hover:text-green-400' : 'text-text-muted'}`}
                >
                  Досягнення Steam
                </span>
                {!hasAchievementsArchive && (
                  <span className="text-xs text-text-muted">(недоступно)</span>
                )}
                {isAchievementsInstalled && (
                  <span className="flex items-center gap-1 text-xs text-green-400">
                    <Check size={12} />
                    встановлено
                  </span>
                )}
              </div>
              <div className="text-sm text-text-muted mt-1">
                <p>Переклад досягнень Steam.</p>
                {game.achievements_archive_size && (
                  <p className="flex items-center gap-1 mt-1 text-green-400">
                    <Archive size={14} />
                    <span>Розмір: {game.achievements_archive_size}</span>
                  </p>
                )}
                {willRemoveAchievements && (
                  <p className="flex items-center gap-1 mt-1 text-red-400">
                    <Trash2 size={14} />
                    <span>Буде видалено</span>
                  </p>
                )}
                {willDownloadAchievements && (
                  <p className="flex items-center gap-1 mt-1 text-green-400">
                    <Archive size={14} />
                    <span>Буде завантажено</span>
                  </p>
                )}
                {willReinstallAchievements && (
                  <p className="flex items-center gap-1 mt-1 text-green-400">
                    <Archive size={14} />
                    <span>Буде перевстановлено</span>
                  </p>
                )}
              </div>
            </div>
          </label>
        )}

        {/* Third-party achievements info */}
        {hasAchievementsArchive && installAchievements && game.achievements_third_party && (
          <div className="bg-glass rounded-xl p-3 border border-border flex items-center gap-2 text-sm">
            <Info size={16} className="text-neon-blue shrink-0" />
            <span className="text-text-muted">
              Автор перекладу досягнень:{' '}
              <span className="text-text-main">{game.achievements_third_party}</span>
            </span>
          </div>
        )}

        {/* Info about what will happen */}
        {(totalDownloadSize !== 'N/A' || willRemoveVoice || willRemoveAchievements) && (
          <div className="bg-glass rounded-xl p-4 border border-border space-y-2">
            {totalDownloadSize !== 'N/A' && (
              <div className="flex items-center gap-2 text-sm">
                <Archive size={16} className="text-text-muted" />
                <span className="text-text-muted">Буде завантажено:</span>
                <span className="text-text-main font-medium">{totalDownloadSize}</span>
              </div>
            )}
            {(willRemoveVoice || willRemoveAchievements) && (
              <div className="flex items-center gap-2 text-sm">
                <Trash2 size={16} className="text-red-400" />
                <span className="text-red-400">
                  Буде видалено:{' '}
                  {[
                    willRemoveVoice && 'озвучення',
                    willRemoveAchievements && 'досягнення',
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            data-gamepad-cancel
            data-gamepad-modal-item
            className="flex-1 px-6 py-3 rounded-xl bg-glass border border-border text-text-main font-semibold hover:bg-glass-hover transition-colors"
          >
            Скасувати
          </button>
          <button
            onClick={handleConfirm}
            disabled={!hasChanges}
            data-gamepad-confirm
            data-gamepad-modal-item
            className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-opacity ${
              !hasChanges
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-color-accent to-color-main text-text-dark hover:opacity-90'
            }`}
          >
            {isReinstall ? 'Застосувати' : 'Встановити'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

/**
 * Calculate total size from size strings like "150.00 MB" and "50.00 MB"
 */
function calculateTotalSize(sizes: string[]): string {
  if (sizes.length === 0) return 'N/A';
  if (sizes.length === 1) return sizes[0];

  const parseSize = (sizeStr: string): number => {
    const match = sizeStr.trim().match(/([\d.]+)\s*(B|KB|MB|GB)/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();

    const multipliers: Record<string, number> = {
      B: 1,
      KB: 1024,
      MB: 1024 * 1024,
      GB: 1024 * 1024 * 1024,
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
