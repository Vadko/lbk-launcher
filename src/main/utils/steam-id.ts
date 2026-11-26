const STEAM_ID64_BASE = 76561197960265728n;
const MAX_ACCOUNT_ID = 0xffffffffn;

/** A Steam3 account id as `userdata/<id>` names it; `0` is Steam's anonymous placeholder. */
export function isSteamAccountId(steam3Id: string): boolean {
  if (!/^\d+$/.test(steam3Id)) {
    return false;
  }
  const id = BigInt(steam3Id);
  return id > 0n && id <= MAX_ACCOUNT_ID;
}

/** The base SteamID64 (account 0) is not an account, and Steam's Web API answers it with 400. */
export function isSteamId64(steamId: string): boolean {
  if (!/^\d+$/.test(steamId)) {
    return false;
  }
  const id = BigInt(steamId);
  return id > STEAM_ID64_BASE && id <= STEAM_ID64_BASE + MAX_ACCOUNT_ID;
}

export function steam3ToSteam64(steam3Id: string): string {
  return (BigInt(steam3Id) + STEAM_ID64_BASE).toString();
}

export function steam64ToSteam3(steam64Id: string): string {
  return (BigInt(steam64Id) - STEAM_ID64_BASE).toString();
}
