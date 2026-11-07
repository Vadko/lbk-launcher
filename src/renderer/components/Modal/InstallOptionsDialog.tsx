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
import {
  achievementsOptionState,
  calculateTotalSize,
  type InstallComponentChanges,
} from '../../utils/installOptions';
import { Button } from '../ui/Button';
import { SelectDropdown, type SelectOption } from '../ui/SelectDropdown';
import { AchievementsOption } from './InstallOptions/AchievementsOption';
import { OptionCheckbox } from './InstallOptions/OptionCheckbox';
import { SteamArtworkOption } from './InstallOptions/SteamArtworkOption';
import { Modal } from './Modal';

interface InstallOptionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (installOptions: InstallOptions, changes: InstallComponentChanges) => void;
  game: Game;
  defaultCreateBackup: boolean;
  defaultSteamArtwork: boolean;
  installationInfo?: InstallationInfo;
  isCustomPath?: boolean; // True if installed via custom path (not Steam folder)
  installsIntoChosenFolder?: boolean;
  availablePlatforms?: GamePath[]; // List of platforms with availability info
  // Read by the install pre-check right before the dialog opens.
  steamArtworkApplied: boolean;
}

export const InstallOptionsDialog: React.FC<InstallOptionsDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  game,
  defaultCreateBackup,
  defaultSteamArtwork,
  installationInfo,
  isCustomPath,
  installsIntoChosenFolder = false,
  availablePlatforms = [],
  steamArtworkApplied,
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
  const initialSteamArtwork = isReinstall ? steamArtworkApplied : defaultSteamArtwork;

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
  const [installSteamArtwork, setInstallSteamArtwork] = useState(initialSteamArtwork);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | 'auto'>(
    defaultPlatform
  );

  const defaultsRef = useRef({
    defaultCreateBackup,
    initialSteamArtwork,
    isVoiceInstalled,
    isAchievementsInstalled,
    isReinstall,
    defaultPlatform,
  });

  useEffect(() => {
    defaultsRef.current = {
      defaultCreateBackup,
      initialSteamArtwork,
      isVoiceInstalled,
      isAchievementsInstalled,
      isReinstall,
      defaultPlatform,
    };
  }, [
    defaultCreateBackup,
    initialSteamArtwork,
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
    setInstallSteamArtwork(defaults.initialSteamArtwork);
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
  // Main resolves 'auto' to Steam for a chosen folder, otherwise to the first detected store, and to a Steam folder pick when none is found.
  const targetPlatform =
    selectedPlatform !== 'auto'
      ? selectedPlatform
      : installsIntoChosenFolder
        ? 'steam'
        : (supportedPlatforms.find((p) => p.exists)?.platform ?? 'steam');
  const targetsSteam = !!isSteamGame && !!game.steam_app_id && targetPlatform === 'steam';
  const willApplyLaunchOptions =
    targetsSteam &&
    (steamLaunchOptionsWindows !== null || steamLaunchOptionsLinux !== null);
  const hasSteamArtwork =
    targetsSteam && !!(game.capsule_path || game.banner_path || game.logo_path);
  // Alone it is applied to the installed Steam record; next to anything else the install applies it.
  const changesArtworkAlone =
    isReinstall &&
    hasSteamArtwork &&
    installSteamArtwork !== initialSteamArtwork &&
    installationInfo?.installedPlatform === 'steam' &&
    !installText &&
    !willDownloadVoice &&
    !achievements.willDownload &&
    !achievements.willReinstall;

  const handleConfirm = () => {
    onConfirm(
      {
        createBackup,
        installText,
        installVoice: hasVoiceArchive ? installVoice : false,
        installAchievements: achievements.install,
        installSteamArtwork: hasSteamArtwork ? installSteamArtwork : initialSteamArtwork,
        platform: selectedPlatform,
      },
      {
        removeVoice: willRemoveVoice,
        removeAchievements: achievements.willRemove,
        updateSteamArtwork: changesArtworkAlone,
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
      achievements.willRemove ||
      changesArtworkAlone
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
            <OptionCheckbox checked={createBackup} onChange={setCreateBackup} />
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
          <OptionCheckbox checked={installText} onChange={setInstallText} />
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
          <OptionCheckbox
            checked={
              (hasVoiceArchive && installVoice) || (isVoiceIntegrated && installText)
            }
            onChange={isVoiceIntegrated ? setInstallText : setInstallVoice}
            disabled={!hasVoiceArchive && !isVoiceIntegrated}
          />
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

        {hasSteamArtwork && (
          <SteamArtworkOption
            checked={installSteamArtwork}
            onToggle={setInstallSteamArtwork}
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
          <Button
            variant="secondary_simple"
            onClick={onClose}
            data-gamepad-cancel
            data-gamepad-modal-item
            className="flex-1"
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleConfirm}
            variant={!hasChanges ? 'secondary' : 'gradient'}
            disabled={!hasChanges}
            data-gamepad-confirm
            data-gamepad-modal-item
            className="flex-1"
          >
            {t('installOptions.confirm')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
