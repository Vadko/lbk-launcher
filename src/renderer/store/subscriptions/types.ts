import type { Game } from '../../../shared/types';

export interface BaseNotification {
  id: string;
  type: 'status-change' | 'version-update' | 'app-update' | 'progress-change' | 'team-new-game' | 'team-status-change';
  gameName: string;
  timestamp: number;
}

export interface Notification extends BaseNotification {
  oldValue?: string;
  newValue?: string;
  gameId: string;
  teamName?: string;
  read: boolean;
}

export interface ToastNotification extends BaseNotification {
  message: string;
  gameId: string;
}

export type GameProgress = Pick<
  Game,
  | 'translation_progress'
  | 'editing_progress'
  | 'voice_progress'
  | 'textures_progress'
  | 'fonts_progress'
>;

export interface SerializedMap {
  __type: 'Map';
  data: [string, unknown][];
}

export interface SerializedSet {
  __type: 'Set';
  data: string[];
}

export type PersistedSubscriptionsState = {
  subscribedGames: Set<string>;
  subscribedGameStatuses: Map<string, string>;
  subscribedGameProgress: Map<string, GameProgress>;
  subscribedTeams: Set<string>;
  promptedGamesForSubscription: Set<string>;
  notifications: Notification[];
  unreadCount: number;
  // Track which version updates have been shown to avoid duplicate notifications
  notifiedVersions: Map<string, string>; // gameId -> version
};
