type WineLauncher = 'crossover' | 'manual';

export interface WinePrefixRef {
  launcher: WineLauncher;
  /** Absolute host path of the prefix (the folder holding drive_c and system.reg). */
  prefix: string;
  /** The bottle name CrossOver shows, or the folder name of a manually added prefix. */
  label: string;
}

/** A prefix as Settings lists it. */
export interface WineBottle extends WinePrefixRef {
  // Added by the player, so it can be removed; CrossOver's own bottles cannot
  userAdded: boolean;
  hasSteam: boolean;
}

export type AddWinePrefixResult =
  | { success: true; prefix: WinePrefixRef }
  | { success: false; error: 'not-a-prefix' | 'cancelled' | 'failed' };

export interface WineAPI {
  addWinePrefix: () => Promise<AddWinePrefixResult>;
  removeWinePrefix: (prefix: string) => Promise<void>;
}
