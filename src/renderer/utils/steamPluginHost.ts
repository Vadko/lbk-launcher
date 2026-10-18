import type {
  AchievementsBadge,
  MillenniumFailure,
  MillenniumInstallResult,
  MillenniumProgress,
  MillenniumUnsupportedReason,
} from '@/shared/plugin-host-types';

type HostOs = 'windows' | 'linux' | 'macos' | 'unknown';

let cachedOs: HostOs | null = null;

export function hostOs(): HostOs {
  if (cachedOs) {
    return cachedOs;
  }
  let platform: string | undefined;
  try {
    platform = window.electronAPI?.getPlatform?.();
  } catch {
    platform = undefined;
  }
  cachedOs =
    platform === 'windows' || platform === 'linux' || platform === 'macos'
      ? platform
      : 'unknown';
  return cachedOs;
}

function openSite(url: string, label: string): void {
  window.electronAPI?.openExternal?.(url).catch((error: unknown) => {
    console.warn(`[SteamPluginHost] Opening the ${label} site failed:`, error);
  });
}

export const openMillenniumSite = (): void =>
  openSite('https://steambrew.app', 'Millennium');
export const openDeckySite = (): void => openSite('https://decky.xyz', 'Decky Loader');

const DECKY_HOST_TEXT =
  'Millennium несумісний із Decky Loader, тож тут переклад досягнень показується через плагін «LBK Bridge» для Decky Loader.';

const UNSUPPORTED_TEXT: Record<MillenniumUnsupportedReason, string> = {
  'flatpak-steam': 'Millennium не підтримує Steam, встановлений через Flatpak.',
  'snap-steam': 'Millennium не підтримує Steam, встановлений через Snap.',
  arch: "Millennium працює лише на комп'ютерах з процесором x86-64.",
  'steam-rt64':
    'Millennium не працює з 64-бітною бета-версією клієнта Steam. Вийдіть із бета-програми в налаштуваннях Steam («Сумісність»/«Бета-версії»).',
  'missing-libssl32':
    'Бракує 32-бітної бібліотеки OpenSSL 3 (пакет libssl3:i386 або lib32-openssl). Встановіть її й спробуйте ще раз.',
  'steam-home-link':
    'Не знайдено ~/.steam/steam, який вказує на теку Steam. Запустіть Steam один раз і спробуйте ще раз.',
  nixos:
    'На NixOS встановіть Millennium засобами системи — лаунчер сам додасть до нього плагін «LBK Bridge».',
  'macos-too-old': 'Millennium потребує macOS 13.3 або новішої.',
  'no-release': 'Встановлення Millennium з лаунчера для цієї системи ще готується.',
  'millennium-v2':
    'У вас стара версія Millennium. Оновіть її до версії 3 офіційним інсталятором — після цього лаунчер сам додасть плагін «LBK Bridge».',
  steamos: DECKY_HOST_TEXT,
  'decky-present': DECKY_HOST_TEXT,
  'no-steam': 'Лаунчер не знайшов Steam на цьому пристрої.',
};

export function millenniumUnsupportedText(
  reason: MillenniumUnsupportedReason | null
): string {
  if (reason === null) {
    return 'Millennium не підтримується на цій системі.';
  }
  if (reason === 'no-release' && hostOs() === 'macos') {
    return 'Збірка Millennium для macOS ще готується.';
  }
  return UNSUPPORTED_TEXT[reason];
}

const INSTALL_FAILED_TEXT = 'Не вдалося встановити Millennium.';

const FAILURE_TEXT: Record<MillenniumFailure, string> = {
  'download-failed':
    "Не вдалося завантажити Millennium. Перевірте з'єднання з інтернетом і спробуйте ще раз.",
  'checksum-mismatch':
    'Завантажений файл Millennium пошкоджено або підмінено. Встановлення скасовано.',
  'extract-failed': 'Не вдалося розпакувати Millennium.',
  'av-blocked':
    'Антивірус видалив або заблокував файли Millennium. Додайте теку Steam до винятків антивіруса й спробуйте ще раз.',
  'not-writable':
    'Лаунчер не має доступу на запис до теки Steam. Встановіть Millennium офіційним інсталятором.',
  conflict:
    'У теці Steam уже є файли іншого мода, який завантажується так само, як Millennium. Лаунчер не змінюватиме їх.',
  'not-prepared': 'Спершу завантажте Millennium ще раз.',
  'script-failed': 'Не вдалося встановити файли Millennium.',
  'files-locked':
    'Файли Steam ще зайняті. Millennium встановиться після наступного закриття Steam.',
  cancelled: 'Встановлення Millennium скасовано.',
  busy: 'Лаунчер уже змінює Millennium. Зачекайте, доки це завершиться.',
  'plugin-not-connected':
    'Millennium встановлено, але плагін «LBK Bridge» ще не підключився. Перевірте, чи Steam запущено, і натисніть «Перевірити ще раз».',
  unsupported: INSTALL_FAILED_TEXT,
  'restart-failed': INSTALL_FAILED_TEXT,
};

export function millenniumFailureText(reason: MillenniumFailure | undefined): string {
  return reason === undefined ? INSTALL_FAILED_TEXT : FAILURE_TEXT[reason];
}

const PHASE_TEXT: Record<MillenniumProgress['phase'], string> = {
  download: 'Завантаження Millennium…',
  verify: 'Перевірка файлів…',
  extract: 'Розпакування…',
  'stop-steam': 'Закриття Steam…',
  'install-files': 'Встановлення файлів…',
  'start-steam': 'Запуск Steam…',
  'wait-plugin': 'Очікування підключення плагіна «LBK Bridge»…',
};

export function millenniumPhaseText(
  phase: MillenniumProgress['phase'],
  operation: 'install' | 'uninstall'
): string {
  return operation === 'uninstall' && phase === 'install-files'
    ? 'Видалення файлів Millennium…'
    : PHASE_TEXT[phase];
}

export function achievementsBadgeDetail(badge: AchievementsBadge): string | null {
  if (badge.state === 'setting-off') {
    return 'У налаштуваннях вимкнено «Швидке застосування параметрів запуску Steam» — без нього лаунчер не підключає плагін «LBK Bridge».';
  }
  if (badge.state === 'unsupported') {
    return millenniumUnsupportedText(badge.unsupportedReason);
  }
  return null;
}

// Decided from the activation result: Steam may have been closed between prepare and activate.
export function activationOutcome(
  result: MillenniumInstallResult
): 'queued' | 'done-offline' | 'wait-plugin' {
  if (result.queued) {
    return 'queued';
  }
  return result.steamRunning === false ? 'done-offline' : 'wait-plugin';
}

// Steam may have started since the modal opened; when nothing is known, ask rather than restart it unasked.
export function steamRunningBeforeChange(
  fresh: boolean | undefined,
  cached: boolean | undefined
): boolean {
  return fresh ?? cached ?? true;
}
