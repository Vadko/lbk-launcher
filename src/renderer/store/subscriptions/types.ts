import type { Game } from '../../../shared/types';

interface BaseNotification {
  id: string;
  type:
    | 'status-change'
    | 'version-update'
    | 'app-update'
    | 'progress-change'
    | 'team-new-game'
    | 'team-status-change'
    | 'first-favorite'
    | 'feedback-reply'
    | 'review-rejected'
    | 'review-published';
  gameName: string;
  timestamp: number;
  // The review thread and entry a review notice is about
  feedbackId?: string;
  entryId?: string;
}

export interface Notification extends BaseNotification {
  oldValue?: string;
  newValue?: string;
  gameId: string;
  teamName?: string;
  read: boolean;
  message?: string;
  sourceId?: string;
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
  // Track which version updates were surfaced, so a dismissed update doesn't re-nag.
  notifiedVersions: Map<string, string>; // gameId -> version
  // Feedback-reply ids ever shown, so dedup survives clearing the list.
  seenFeedbackReplyIds: string[];
  // Moderation events already handled (reviewModerationKey), so a catch-up repeating one stays quiet
  seenModerationEvents: string[];
};
