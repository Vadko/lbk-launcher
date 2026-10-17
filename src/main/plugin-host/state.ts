import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { app } from 'electron';
import { getSteamPath } from '@/main/game-detector/steam';
import { isI386Elf, parseLdconfig } from '@/main/millennium-install/linux';
import { parseHwArm64 } from '@/main/millennium-install/macos';
import {
  installPathsFor,
  type MillenniumInstallPaths,
} from '@/main/millennium-install/paths';
import {
  type MillenniumInstallRecord,
  managedByFor,
  readInstallRecord,
  recordPathIn,
} from '@/main/millennium-install/record';
import {
  type MacHardwareArch,
  MILLENNIUM_PIN,
  type MillenniumOs,
  type SelectedMillenniumRelease,
  selectMillenniumAsset,
} from '@/main/millennium-install/release';
import { getPendingSteamActions } from '@/main/steam-pending-actions';
import {
  type DeckyInfo,
  detectDecky,
  isDeckyInstalledSync,
  resetDeckyDetectCache,
} from '@/main/utils/decky';
import { detectMillennium } from '@/main/utils/millennium';
import { getMillenniumPluginState } from '@/main/utils/millennium-plugin';
import {
  getDarwinVersion,
  getPlatform,
  isGamescopeSession,
  isSteamDeckHardware,
  isSteamOS,
} from '@/main/utils/platform';
import { MILLENNIUM_PLUGIN_VERSION } from '@/main/utils/steam-bridge-ops';
import { getConnectedPluginInfo } from '@/main/utils/steam-bridge-server';
import { currentLinuxSteamType } from '@/main/utils/steam-launcher';
import { execFileOnHost, findSteamPids } from '@/main/utils/steam-process';
import { isCefDebuggingEnabledInSettings } from '@/main/utils/store-storage';
import type { AchievementsBadge, PluginHostState } from '@/shared/types';
import { compareVersions } from '@/shared/version';
import {
  computeAchievementsBadge,
  deckyLoaderOffer,
  evaluateMillenniumSupport,
  type HostFacts,
  type MillenniumSupport,
  pickPluginHost,
  withPluginHostOverride,
} from './support';

const execFileAsync = promisify(execFile);
const FACTS_CACHE_MS = 60_000;
const LIBSSL_DIRS = ['/usr/lib32', '/usr/lib/i386-linux-gnu', '/usr/lib'];
const LDCONFIG_CANDIDATES = ['/sbin/ldconfig', '/usr/sbin/ldconfig', 'ldconfig'];

export interface HostSnapshot {
  facts: HostFacts;
  support: MillenniumSupport;
  host: PluginHostState['host'];
  os: MillenniumOs | null;
  paths: MillenniumInstallPaths | null;
  record: MillenniumInstallRecord | null;
  release: SelectedMillenniumRelease | null;
  hwArch: MacHardwareArch | null;
  decky: DeckyInfo | null;
}

async function macHardwareArch(): Promise<MacHardwareArch> {
  try {
    const { stdout } = await execFileAsync(
      '/usr/sbin/sysctl',
      ['-n', 'hw.optional.arm64'],
      {
        timeout: 5000,
      }
    );
    return parseHwArm64(stdout) ? 'arm64' : 'x86_64';
  } catch {
    // Intel Macs have no such OID.
    return 'x86_64';
  }
}

async function hasI386OpenSsl(): Promise<boolean> {
  for (const ldconfig of LDCONFIG_CANDIDATES) {
    try {
      const { stdout } = await execFileOnHost(ldconfig, ['-p'], 5000);
      return parseLdconfig(stdout);
    } catch {
      // Try the next location.
    }
  }
  if (process.env.FLATPAK_ID) {
    return false;
  }
  return LIBSSL_DIRS.some((dir) => {
    try {
      const fd = fs.openSync(path.join(dir, 'libssl.so.3'), 'r');
      try {
        const header = Buffer.alloc(20);
        fs.readSync(fd, header, 0, 20, 0);
        return isI386Elf(header);
      } finally {
        fs.closeSync(fd);
      }
    } catch {
      return false;
    }
  });
}

function realpathOrNull(p: string): string | null {
  try {
    return fs.realpathSync(p);
  } catch {
    return null;
  }
}

function readsSteamRt64Beta(home: string): boolean {
  try {
    const beta = fs.readFileSync(path.join(home, '.steam/steam/package/beta'), 'utf8');
    return /steamrt64|rt3|64-?bit/i.test(beta);
  } catch {
    return false;
  }
}

const SYSTEM_MILLENNIUM_LIBS = [
  '/usr/lib/millennium/libmillennium_x86.so',
  '/run/host/usr/lib/millennium/libmillennium_x86.so',
];

async function gatherLinuxFacts(steamPath: string | null): Promise<HostFacts['linux']> {
  const home = os.homedir();
  const homeLink = realpathOrNull(path.join(home, '.steam/steam'));
  return {
    steamType: currentLinuxSteamType(steamPath),
    steamOS: isSteamOS() || isSteamDeckHardware(),
    systemMillennium: SYSTEM_MILLENNIUM_LIBS.some((lib) => fs.existsSync(lib)),
    deckyInstalled: isDeckyInstalledSync(),
    nixos: fs.existsSync('/etc/NIXOS') || fs.existsSync('/run/host/etc/NIXOS'),
    homeLinkOk:
      homeLink !== null && steamPath !== null && homeLink === realpathOrNull(steamPath),
    rt64: readsSteamRt64Beta(home),
    libssl32: await hasI386OpenSsl(),
  };
}

interface GatheredFacts {
  facts: HostFacts;
  release: SelectedMillenniumRelease | null;
  hwArch: MacHardwareArch | null;
}

let factsCache: { at: number; value: Promise<GatheredFacts> } | null = null;

async function gatherHostFacts(): Promise<GatheredFacts> {
  const platform = getPlatform();
  const steamPath = getSteamPath();
  const hwArch = platform === 'macos' ? await macHardwareArch() : null;
  const release =
    platform === 'unknown'
      ? null
      : selectMillenniumAsset(MILLENNIUM_PIN, platform, hwArch);
  const facts: HostFacts = {
    os: platform,
    arch: process.arch,
    steamPath,
    millenniumGeneration: detectMillennium().generation,
    releaseAvailable: release !== null,
    macos: platform === 'macos' ? { darwin: getDarwinVersion() } : null,
    linux: platform === 'linux' ? await gatherLinuxFacts(steamPath) : null,
  };
  return {
    release,
    hwArch,
    facts: withPluginHostOverride(
      facts,
      app.isPackaged ? undefined : process.env.LBK_PLUGIN_HOST
    ),
  };
}

export function resetHostFacts(): void {
  factsCache = null;
  resetDeckyDetectCache();
}

function cachedFacts(): Promise<GatheredFacts> {
  const now = Date.now();
  if (!factsCache || now - factsCache.at >= FACTS_CACHE_MS || now < factsCache.at) {
    const value = gatherHostFacts();
    factsCache = { at: now, value };
    value.catch(() => {
      factsCache = null;
    });
  }
  return factsCache.value;
}

export async function getHostSnapshot(): Promise<HostSnapshot> {
  const { facts, release, hwArch } = await cachedFacts();
  // Millennium detection has its own cache and may have changed since the facts were gathered.
  const live: HostFacts = {
    ...facts,
    millenniumGeneration: detectMillennium().generation,
  };
  const support = evaluateMillenniumSupport(live);
  const platform = live.os === 'unknown' ? null : live.os;
  const paths =
    platform && live.steamPath ? installPathsFor(platform, live.steamPath) : null;
  const record = paths ? readInstallRecord(recordPathIn(paths.root)) : null;
  return {
    facts: live,
    support,
    host: pickPluginHost(live, support),
    os: platform,
    paths,
    record:
      platform && managedByFor(record, platform, live.steamPath) === 'lbk'
        ? record
        : null,
    release,
    hwArch,
    decky: await detectDecky(),
  };
}

export function deckyStateFor(decky: DeckyInfo | null): PluginHostState['decky'] {
  if (!decky) {
    return null;
  }
  const version = decky.plugin.version;
  const connected = getConnectedPluginInfo();
  const live = connected?.host === 'decky' ? connected.pluginVersion : null;
  const older = (v: string | null) =>
    v === null || compareVersions(v, MILLENNIUM_PLUGIN_VERSION) < 0;
  return {
    installed: decky.installed,
    running: decky.running,
    plugin: {
      installed: decky.plugin.installed,
      version,
      disabled: decky.plugin.disabled,
      connected: live !== null,
      outdated:
        decky.plugin.installed && (older(version) || (live !== null && older(live))),
    },
  };
}

let deckyLoaderInstalling = false;

export function setDeckyLoaderInstalling(value: boolean): void {
  deckyLoaderInstalling = value;
}

export function deckyLoaderStateFor(
  snapshot: HostSnapshot
): PluginHostState['deckyLoader'] {
  return deckyLoaderOffer({
    host: snapshot.host,
    deckyInstalled: snapshot.decky?.installed === true,
    deckyRunning: snapshot.decky?.running === true,
    gamescope: isGamescopeSession(),
    installing: deckyLoaderInstalling,
  });
}

export function pendingMillenniumAction(): 'activate' | 'deactivate' | null {
  for (const action of getPendingSteamActions()) {
    if (action.kind === 'millennium-activate') {
      return 'activate';
    }
    if (action.kind === 'millennium-deactivate') {
      return 'deactivate';
    }
  }
  return null;
}

export async function getAchievementsBadge(
  opts: { steamRunning?: boolean; snapshot?: HostSnapshot } = {}
): Promise<AchievementsBadge> {
  const snapshot = opts.snapshot ?? (await getHostSnapshot());
  const plugin = getMillenniumPluginState();
  const connected = getConnectedPluginInfo();
  const steamRunning = opts.steamRunning ?? (await findSteamPids()).length > 0;
  return computeAchievementsBadge({
    os: snapshot.facts.os,
    settingOn: isCefDebuggingEnabledInSettings(),
    host: snapshot.host,
    steamRunning,
    pluginConnected: connected !== null && connected.host === snapshot.host,
    millennium: {
      v3: snapshot.facts.millenniumGeneration === 'v3',
      pluginInstalled: plugin.installed,
      pluginEnabled: plugin.enabled,
      activationPending: pendingMillenniumAction() === 'activate',
    },
    support: snapshot.support,
    decky: snapshot.decky
      ? {
          installed: snapshot.decky.installed,
          running: snapshot.decky.running,
          pluginInstalled: snapshot.decky.plugin.installed,
          pluginDisabled: snapshot.decky.plugin.disabled,
        }
      : null,
  });
}
