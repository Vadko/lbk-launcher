import type {
  AchievementsBadge,
  MillenniumFailure,
  MillenniumProgress,
  MillenniumUnsupportedReason,
} from '@/shared/types';

const DECKY_URL = 'https://decky.xyz';

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

export function openDeckySite(): void {
  window.electronAPI?.openExternal?.(DECKY_URL).catch((error: unknown) => {
    console.warn('[SteamPluginHost] Opening the Decky Loader site failed:', error);
  });
}

export function millenniumUnsupportedText(
  reason: MillenniumUnsupportedReason | null
): string {
  switch (reason) {
    case 'flatpak-steam':
      return 'Millennium не підтримує Steam, встановлений через Flatpak.';
    case 'snap-steam':
      return 'Millennium не підтримує Steam, встановлений через Snap.';
    case 'arch':
      return "Millennium працює лише на комп'ютерах з процесором x86-64.";
    case 'steam-rt64':
      return 'Millennium не працює з 64-бітною бета-версією клієнта Steam. Вийдіть із бета-програми в налаштуваннях Steam («Сумісність»/«Бета-версії»).';
    case 'missing-libssl32':
      return 'Бракує 32-бітної бібліотеки OpenSSL 3 (пакет libssl3:i386 або lib32-openssl). Встановіть її й спробуйте ще раз.';
    case 'steam-home-link':
      return 'Не знайдено ~/.steam/steam, який вказує на теку Steam. Запустіть Steam один раз і спробуйте ще раз.';
    case 'nixos':
      return 'На NixOS встановіть Millennium засобами системи — лаунчер сам додасть до нього плагін «LBK Bridge».';
    case 'macos-too-old':
      return 'Millennium потребує macOS 13.3 або новішої.';
    case 'no-release':
      return hostOs() === 'macos'
        ? 'Збірка Millennium для macOS ще готується.'
        : 'Встановлення Millennium з лаунчера для цієї системи ще готується.';
    case 'millennium-v2':
      return 'У вас стара версія Millennium. Оновіть її до версії 3 офіційним інсталятором — після цього лаунчер сам додасть плагін «LBK Bridge».';
    case 'steamos':
    case 'decky-present':
      return 'Millennium несумісний із Decky Loader, тож тут переклад досягнень показується через плагін «LBK Bridge» для Decky Loader.';
    case 'no-steam':
      return 'Лаунчер не знайшов Steam на цьому пристрої.';
    default:
      return 'Millennium не підтримується на цій системі.';
  }
}

export function millenniumFailureText(reason: MillenniumFailure | undefined): string {
  switch (reason) {
    case 'download-failed':
      return "Не вдалося завантажити Millennium. Перевірте з'єднання з інтернетом і спробуйте ще раз.";
    case 'checksum-mismatch':
      return 'Завантажений файл Millennium пошкоджено або підмінено. Встановлення скасовано.';
    case 'extract-failed':
      return 'Не вдалося розпакувати Millennium.';
    case 'av-blocked':
      return 'Антивірус видалив або заблокував файли Millennium. Додайте теку Steam до винятків антивіруса й спробуйте ще раз.';
    case 'not-writable':
      return 'Лаунчер не має доступу на запис до теки Steam. Встановіть Millennium офіційним інсталятором.';
    case 'conflict':
      return 'У теці Steam уже є файли іншого мода, який завантажується так само, як Millennium. Лаунчер не змінюватиме їх.';
    case 'not-prepared':
      return 'Спершу завантажте Millennium ще раз.';
    case 'script-failed':
      return 'Не вдалося встановити файли Millennium.';
    case 'files-locked':
      return 'Файли Steam ще зайняті. Millennium встановиться після наступного закриття Steam.';
    case 'cancelled':
      return 'Встановлення Millennium скасовано.';
    case 'busy':
      return 'Лаунчер уже змінює Millennium. Зачекайте, доки це завершиться.';
    case 'plugin-not-connected':
      return 'Millennium встановлено, але плагін «LBK Bridge» ще не підключився. Перевірте, чи Steam запущено, і натисніть «Перевірити ще раз».';
    default:
      return 'Не вдалося встановити Millennium.';
  }
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
