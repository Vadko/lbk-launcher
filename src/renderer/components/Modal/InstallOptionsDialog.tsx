import {
  ArchiveIcon,
  CheckIcon,
  FileTextIcon,
  MonitorIcon,
  ShieldIcon,
  TerminalIcon,
  Trash2Icon,
  Volume2Icon,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Trans } from 'react-i18next';
import { t } from '@/shared/i18n/i18n';
import type {
  Game,
  GamePath,
  InstallationInfo,
  InstallOptions,
  Platform,
} from '../../../shared/types';
import { getReadablePlatform } from '../../helpers/getReadablePlatform';
import { useSteamBridgeStatus } from '../../hooks/useSteamBridgeStatus';
import { achievementsOptionState, calculateTotalSize } from '../../utils/installOptions';
import { SelectDropdown, type SelectOption } from '../ui/SelectDropdown';
import { AchievementsOption } from './InstallOptions/AchievementsOption';
import { Modal } from './Modal';

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
  availablePlatforms?: GamePath[]; // List of platforms with availability info
}

export const InstallOptionsDialog: React.FC<InstallOptionsDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  game,
  defaultCreateBackup,
  installationInfo,
  isCustomPath,
  availablePlatforms = [],
}) => {
  // CheckIcon what's available and what's already installed
  const isSteamGame = game.platforms?.includes('steam');
  // Achievements only available for Steam games installed in Steam folder (not custom path)
  const hasAchievementsArchive = !!(
    isSteamGame &&
    game.achievements_archive_path &&
    !isCustomPath
  );
  const hasVoiceArchive = !!game.voice_archive_path;
  // Voice is integrated in main archive if there's no separate voice archive but voice_progress > 0
  const isVoiceIntegrated = !hasVoiceArchive && (game.voice_progress ?? 0) > 0;

  const isVoiceInstalled = installationInfo?.components?.voice?.installed ?? false;
  const isAchievementsInstalled =
    installationInfo?.components?.achievements?.installed ?? false;
  const isReinstall = !!installationInfo;

  // Filter platforms to only show those that the game supports
  const supportedPlatforms = useMemo(() => {
    if (!availablePlatforms || availablePlatforms.length === 0) {
      return [];
    }
    return availablePlatforms.filter((p) => game.platforms?.includes(p.platform));
  }, [availablePlatforms, game.platforms]);

  // Determine default platform
  const defaultPlatform = useMemo((): Platform | 'auto' => {
    // If there's an installation, use its platform
    if (installationInfo) {
      // Try to find platform from install path
      const firstAvailable = supportedPlatforms.find((p) => p.exists);
      return firstAvailable?.platform || 'auto';
    }
    return 'auto';
  }, [installationInfo, supportedPlatforms]);

  // State for checkboxes - initialize based on what's installed or defaults
  const [createBackup, setCreateBackup] = useState(defaultCreateBackup);
  const [installText, setInstallText] = useState(true);
  const [installVoice, setInstallVoice] = useState(true);
  const [installAchievements, setInstallAchievements] = useState(true);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | 'auto'>(
    defaultPlatform
  );

  const defaultsRef = useRef({
    defaultCreateBackup,
    isVoiceInstalled,
    isAchievementsInstalled,
    isReinstall,
    defaultPlatform,
  });

  useEffect(() => {
    defaultsRef.current = {
      defaultCreateBackup,
      isVoiceInstalled,
      isAchievementsInstalled,
      isReinstall,
      defaultPlatform,
    };
  }, [
    defaultCreateBackup,
    isVoiceInstalled,
    isAchievementsInstalled,
    isReinstall,
    defaultPlatform,
  ]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const defaults = defaultsRef.current;
    setCreateBackup(defaults.defaultCreateBackup);
    setInstallText(true);
    setInstallVoice(defaults.isVoiceInstalled || !defaults.isReinstall);
    setInstallAchievements(defaults.isAchievementsInstalled || !defaults.isReinstall);
    setSelectedPlatform(defaults.defaultPlatform);
  }, [isOpen]);

  // Calculate what will be downloaded/removed
  const willDownloadVoice = hasVoiceArchive && installVoice && !isVoiceInstalled;
  const { status: bridgeStatus } = useSteamBridgeStatus(isOpen && hasAchievementsArchive);
  const achievementsBadge = bridgeStatus?.achievements ?? null;
  const achievements = achievementsOptionState({
    hasArchive: hasAchievementsArchive,
    installed: isAchievementsInstalled,
    checked: installAchievements,
    isReinstall,
    badge: achievementsBadge,
  });
  const willRemoveVoice = hasVoiceArchive && !installVoice && isVoiceInstalled;

  const steamLaunchOptionsWindows = game.steam_launch_options_windows?.trim() || null;
  const steamLaunchOptionsLinux = game.steam_launch_options_linux?.trim() || null;
  const willApplyLaunchOptions =
    isSteamGame &&
    !!game.steam_app_id &&
    (selectedPlatform === 'auto' || selectedPlatform === 'steam') &&
    (steamLaunchOptionsWindows !== null || steamLaunchOptionsLinux !== null);

  const handleConfirm = () => {
    onConfirm(
      {
        createBackup,
        installText,
        installVoice: hasVoiceArchive ? installVoice : false,
        installAchievements: achievements.install,
        platform: selectedPlatform,
      },
      {
        removeVoice: willRemoveVoice,
        removeAchievements: achievements.willRemove,
      }
    );
    onClose();
  };

  // Compute total download size
  const totalDownloadSize = useMemo(() => {
    const sizes: (string | null)[] = [];

    if (installText) {
      sizes.push(game.archive_size);
    }

    if (willDownloadVoice) {
      sizes.push(game.voice_archive_size ?? null);
    }

    if (achievements.willDownload || achievements.willReinstall) {
      sizes.push(game.achievements_archive_size ?? null);
    }

    return calculateTotalSize(sizes.filter(Boolean) as string[]);
  }, [
    game,
    installText,
    willDownloadVoice,
    achievements.willDownload,
    achievements.willReinstall,
  ]);

  // Compute approximate backup size (same as what will be installed)
  const backupSize = useMemo(() => {
    if (isReinstall) {
      return null;
    }

    const sizes: (string | null)[] = installText ? [game.archive_size] : [];

    if (installVoice && hasVoiceArchive) {
      sizes.push(game.voice_archive_size ?? null);
    }

    if (achievements.wants) {
      sizes.push(game.achievements_archive_size ?? null);
    }

    const result = calculateTotalSize(sizes.filter(Boolean) as string[]);
    return result !== 'N/A' ? result : null;
  }, [game, isReinstall, installText, installVoice, hasVoiceArchive, achievements.wants]);

  // Prepare platform options for dropdown
  const platformOptions = useMemo(() => {
    const firstExisting = supportedPlatforms.find((p) => p.exists);
    const options: SelectOption[] = [
      {
        name: firstExisting
          ? t('installOptions.platformAuto', {
              platform: getReadablePlatform(firstExisting.platform),
            })
          : t('installOptions.platformManual', {
              platform: getReadablePlatform(supportedPlatforms[0]?.platform),
            }),
        value: 'auto',
      },
    ];

    supportedPlatforms.forEach((platform) => {
      const platformName = getReadablePlatform(platform.platform);
      options.push({
        name: platformName,
        children: (
          <>
            <span>{platformName}</span>
            <span
              className={`ml-auto ${platform.exists ? 'text-color-main' : 'text-text-muted'}`}
            >
              {platform.exists
                ? t('installOptions.platformFound')
                : t('installOptions.platformNotFound')}
            </span>
          </>
        ),
        value: platform.platform,
      });
    });

    return options;
  }, [supportedPlatforms]);

  // On a new install - at least one component must be selected
  // On a reinstall - any change counts
  const hasChanges = isReinstall
    ? installText ||
      willDownloadVoice ||
      achievements.willDownload ||
      achievements.willReinstall ||
      willRemoveVoice ||
      achievements.willRemove
    : installText || (hasVoiceArchive && installVoice) || achievements.wants;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        isReinstall
          ? t('installOptions.reinstallTitle')
          : t('installOptions.installTitle')
      }
    >
      <div className="flex flex-col gap-6">
        <p className="text-text-muted">
          {isReinstall
            ? t('installOptions.reinstallIntro', { name: game.name })
            : t('installOptions.installIntro', { name: game.name })}
        </p>

        {/* Platform selection - show if multiple platforms available */}
        {supportedPlatforms.length > 0 && (
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2">
              <MonitorIcon size={18} className="text-color-accent" />
              <span className="font-medium text-text-main">
                {t('installOptions.platformLabel')}
              </span>
            </label>
            <SelectDropdown
              options={platformOptions}
              selectedValue={selectedPlatform}
              onSelectionChange={(value) =>
                setSelectedPlatform(value as Platform | 'auto')
              }
              placeholder={t('installOptions.platformPlaceholder')}
              maxHeight={500}
            />
          </div>
        )}

        {/* Backup option - only show for new installs */}
        {!isReinstall && (
          <label className="flex items-start gap-4 cursor-pointer group">
            <div className="relative flex items-center justify-center mt-0.5">
              <input
                type="checkbox"
                checked={createBackup}
                onChange={(e) => setCreateBackup(e.target.checked)}
                data-gamepad-modal-item
                className="appearance-none w-5 h-5 rounded-md bg-glass border border-border checked:bg-color-main checked:border-color-main transition-colors cursor-pointer focus:ring-2 focus:ring-color-main/50 focus:outline-hidden"
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
                <ShieldIcon size={18} className="text-color-accent" />
                <span className="font-medium text-text-main group-hover:text-color-accent transition-colors">
                  {t('installOptions.backupTitle')}
                </span>
              </div>
              <p className="text-sm text-text-muted mt-1">
                {t('installOptions.backupDescription')}
              </p>
              {createBackup && backupSize && (
                <p className="flex items-center gap-1 mt-1 text-color-accent text-sm">
                  <ArchiveIcon size={14} />
                  <span>{t('installOptions.backupSize', { size: backupSize })}</span>
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
              className="appearance-none w-5 h-5 rounded-md bg-glass border border-border checked:bg-color-main checked:border-color-main transition-colors cursor-pointer focus:ring-2 focus:ring-color-main/50 focus:outline-hidden"
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
              <FileTextIcon size={18} className="text-color-accent" />
              <span className="font-medium text-text-main group-hover:text-color-accent transition-colors">
                {t('installOptions.textTitle')}
              </span>
              {isReinstall && (
                <span className="flex items-center gap-1 text-xs text-green-400">
                  <CheckIcon size={12} />
                  {t('installOptions.installed')}
                </span>
              )}
            </div>
            <div className="text-sm text-text-muted mt-1">
              <p>{t('installOptions.textDescription')}</p>
              {game.archive_size && (
                <p className="flex items-center gap-1 mt-1 text-color-accent">
                  <ArchiveIcon size={14} />
                  <span>{t('installOptions.size', { size: game.archive_size })}</span>
                </p>
              )}
              {isReinstall && installText && (
                <p className="flex items-center gap-1 mt-1 text-green-400">
                  <ArchiveIcon size={14} />
                  <span>{t('installOptions.willReinstall')}</span>
                </p>
              )}
              {!isReinstall && installText && (
                <p className="flex items-center gap-1 mt-1 text-green-400">
                  <ArchiveIcon size={14} />
                  <span>{t('installOptions.willInstall')}</span>
                </p>
              )}
            </div>
          </div>
        </label>

        {/* Voice archive option */}
        <label
          className={`flex items-start gap-4 group ${hasVoiceArchive || isVoiceIntegrated ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
        >
          <div className="relative flex items-center justify-center mt-0.5">
            <input
              type="checkbox"
              checked={
                (hasVoiceArchive && installVoice) || (isVoiceIntegrated && installText)
              }
              onChange={(e) => {
                if (!isVoiceIntegrated) {
                  setInstallVoice(e.target.checked);
                } else {
                  setInstallText(e.target.checked);
                }
              }}
              disabled={!hasVoiceArchive && !isVoiceIntegrated}
              data-gamepad-modal-item
              className={`appearance-none w-5 h-5 rounded-md bg-glass border border-border checked:bg-color-main checked:border-color-main transition-colors focus:ring-2 focus:ring-color-main/50 focus:outline-hidden ${hasVoiceArchive || isVoiceIntegrated ? 'cursor-pointer' : 'cursor-not-allowed'}`}
            />
            <svg
              className={`absolute w-3 h-3 text-text-dark pointer-events-none transition-opacity ${
                (hasVoiceArchive && installVoice) || (isVoiceIntegrated && installText)
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
              <Volume2Icon
                size={18}
                className={
                  hasVoiceArchive || isVoiceIntegrated
                    ? 'text-purple-400'
                    : 'text-text-muted'
                }
              />
              <span
                className={`font-medium transition-colors ${hasVoiceArchive || isVoiceIntegrated ? 'text-text-main group-hover:text-purple-400' : 'text-text-muted'}`}
              >
                {t('installOptions.voiceTitle')}
              </span>
              {!hasVoiceArchive && !isVoiceIntegrated && (
                <span className="text-xs text-text-muted">
                  {t('installOptions.unavailable')}
                </span>
              )}
              {isVoiceIntegrated && (
                <span className="text-xs text-purple-400">
                  {t('installOptions.voiceWithText')}
                </span>
              )}
              {isVoiceInstalled ||
                (isVoiceIntegrated && isReinstall && (
                  <span className="flex items-center gap-1 text-xs text-green-400">
                    <CheckIcon size={12} />
                    {t('installOptions.installed')}
                  </span>
                ))}
            </div>
            <div className="text-sm text-text-muted mt-1">
              <p>{t('installOptions.voiceDescription')}</p>
              {game.voice_archive_size && (
                <p className="flex items-center gap-1 mt-1 text-purple-400">
                  <ArchiveIcon size={14} />
                  <span>
                    {t('installOptions.size', { size: game.voice_archive_size })}
                  </span>
                </p>
              )}
              {willRemoveVoice && (
                <p className="flex items-center gap-1 mt-1 text-red-400">
                  <Trash2Icon size={14} />
                  <span>{t('installOptions.willRemove')}</span>
                </p>
              )}
              {willDownloadVoice && (
                <p className="flex items-center gap-1 mt-1 text-green-400">
                  <ArchiveIcon size={14} />
                  <span>{t('installOptions.willDownload')}</span>
                </p>
              )}
            </div>
          </div>
        </label>

        {isSteamGame && (
          <AchievementsOption
            game={game}
            hasArchive={hasAchievementsArchive}
            installed={isAchievementsInstalled}
            badge={achievementsBadge}
            option={achievements}
            onToggle={setInstallAchievements}
          />
        )}

        {/* Steam launch options info */}
        {willApplyLaunchOptions && (
          <div className="bg-glass rounded-xl p-3 border border-border flex items-start gap-2 text-sm">
            <TerminalIcon size={16} className="text-color-main shrink-0 mt-0.5" />
            <div className="text-text-muted">
              <p>
                <Trans
                  i18nKey="installOptions.launchOptions"
                  components={{ hl: <span className="text-text-main" /> }}
                />
              </p>
              {steamLaunchOptionsWindows && (
                <p className="mt-1">
                  <span className="text-text-main">Windows:</span>{' '}
                  <code className="text-color-main">{steamLaunchOptionsWindows}</code>
                </p>
              )}
              {steamLaunchOptionsLinux && (
                <p className="mt-1">
                  <span className="text-text-main">Linux (Proton):</span>{' '}
                  <code className="text-color-main">{steamLaunchOptionsLinux}</code>
                </p>
              )}
            </div>
          </div>
        )}

        {/* InfoIcon about what will happen */}
        {(totalDownloadSize !== 'N/A' || willRemoveVoice || achievements.willRemove) && (
          <div className="bg-glass rounded-xl p-4 border border-border space-y-2">
            {totalDownloadSize !== 'N/A' && (
              <div className="flex items-center gap-2 text-sm">
                <ArchiveIcon size={16} className="text-text-muted" />
                <span className="text-text-muted">
                  {t('installOptions.totalDownload')}
                </span>
                <span className="text-text-main font-medium">{totalDownloadSize}</span>
              </div>
            )}
            {(willRemoveVoice || achievements.willRemove) && (
              <div className="flex items-center gap-2 text-sm">
                <Trash2Icon size={16} className="text-red-400" />
                <span className="text-red-400">
                  {t('installOptions.removeList', {
                    items: [
                      willRemoveVoice && t('installOptions.removeVoice'),
                      achievements.willRemove && t('installOptions.removeAchievements'),
                    ]
                      .filter(Boolean)
                      .join(', '),
                  })}
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
            {t('common.cancel')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!hasChanges}
            data-gamepad-confirm
            data-gamepad-modal-item
            className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-opacity ${
              !hasChanges
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-linear-to-r/srgb from-color-accent to-color-main text-text-dark hover:opacity-90'
            }`}
          >
            {t('installOptions.confirm')}
          </button>
        </div>
      </div>
    </Modal>
  );
};
