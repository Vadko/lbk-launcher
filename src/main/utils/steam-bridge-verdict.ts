import { hash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';
import { getSteamPath } from '@/main/game-detector/steam';
import { isCefFlagFilePresent } from '@/main/utils/cef-flag-file';
import { detectMillennium } from '@/main/utils/millennium';
import { forCurrentOS } from '@/main/utils/platform';
import {
  deleteStoreValue,
  readStoreValue,
  writeStoreValue,
} from '@/main/utils/store-storage';

// Main-only key, but the renderer's generic store setter can write any name, so the shape is checked.
const bridgeVerdictSchema = z.object({
  verdict: z.literal('blocked-no-port'),
  fingerprint: z.string(),
  decidedAt: z.string(),
  evidence: z.array(z.string()),
});

type BridgeVerdict = z.infer<typeof bridgeVerdictSchema>;

const VERDICT_KEY = 'steam-bridge-verdict';
const PROMPTED_KEY = 'steam-restart-prompted';

export function computeBridgeFingerprint(i: {
  millenniumEvidence: string[];
  steamClientMtimeMs: number | null;
  flagPresent: boolean;
}): string {
  const canonical = JSON.stringify({
    millenniumEvidence: [...i.millenniumEvidence].sort(),
    steamClientMtimeMs: i.steamClientMtimeMs,
    flagPresent: i.flagPresent,
  });
  return hash('sha1', canonical);
}

function steamClientMtimeMs(): number | null {
  const steamPath = getSteamPath();
  if (!steamPath) {
    return null;
  }
  const candidates = forCurrentOS<string[]>({
    windows: ['steamclient64.dll', 'steamclient.dll'],
    linux: ['ubuntu12_32/steamclient.so'],
    macos: [
      'Steam.AppBundle/Steam/Contents/MacOS/steamclient.dylib',
      'steamclient.dylib',
    ],
    other: [],
  });
  for (const candidate of candidates) {
    try {
      return fs.statSync(path.join(steamPath, candidate)).mtimeMs;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

function currentFingerprint(): string {
  return computeBridgeFingerprint({
    millenniumEvidence: detectMillennium().evidence,
    steamClientMtimeMs: steamClientMtimeMs(),
    flagPresent: isCefFlagFilePresent(),
  });
}

function readVerdict(fingerprint: string): BridgeVerdict | null {
  const raw = readStoreValue(VERDICT_KEY);
  if (raw === undefined) {
    return null;
  }
  const verdict = bridgeVerdictSchema.safeParse(raw).data;
  if (verdict?.fingerprint !== fingerprint) {
    deleteStoreValue(VERDICT_KEY);
    return null;
  }
  return verdict;
}

export function clearBlockedVerdict(): void {
  if (readStoreValue(VERDICT_KEY) !== undefined) {
    deleteStoreValue(VERDICT_KEY);
    console.log('[SteamBridge] Cleared the blocked verdict');
  }
}

export function clearSteamBridgeVerdict(): void {
  clearBlockedVerdict();
  deleteStoreValue(PROMPTED_KEY);
}

export function isBlockedVerdictPresent(): boolean {
  return readVerdict(currentFingerprint()) !== null;
}

export function recordBlockedVerdict(evidence: string): void {
  const verdict: BridgeVerdict = {
    verdict: 'blocked-no-port',
    fingerprint: currentFingerprint(),
    decidedAt: new Date().toISOString(),
    evidence: [evidence],
  };
  writeStoreValue(VERDICT_KEY, verdict);
}

// At most once per bridge fingerprint (BRIDGE §3.5).
export function claimPromptForFingerprint(): boolean {
  const fingerprint = currentFingerprint();
  if (readStoreValue(PROMPTED_KEY) === fingerprint) {
    return false;
  }
  writeStoreValue(PROMPTED_KEY, fingerprint);
  return true;
}
