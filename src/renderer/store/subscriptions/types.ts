import type { ReviewEvent } from '../../../shared/game-reviews-types';
import type { Game } from '../../../shared/types';
import type { ReviewRefusalReason } from '../../utils/reviewRefusalMessage';

// The translationProgress dictionary keys
export type ProgressKind = 'translation' | 'editing' | 'voice' | 'textures' | 'fonts';

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
  // A status (an older notice holds its label) or a version
  oldValue?: string;
  newValue?: string;
  teamName?: string;
  // Raw values the notice is worded from in the language shown
  progress?: { kind: ProgressKind; from: number; to: number };
  reply?: Pick<ReviewEvent, 'authorRole' | 'authorName' | 'message'>;
  refusalReason?: ReviewRefusalReason;
  // The worded reply or refusal of a notice stored before its raw values
  message?: string;
}

export interface Notification extends BaseNotification {
  gameId: string;
  read: boolean;
  sourceId?: string;
}

export interface ToastNotification extends BaseNotification {
  gameId: string;
}

export type NoticeContent = Omit<BaseNotification, 'id' | 'timestamp'>;

export type GameProgress = Pick<
  Game,
  | 'translation_progress'
  | 'editing_progress'
  | 'voice_progress'
  | 'textures_progress'
  | 'fonts_progress'
>;

// The translationProgress dictionary key of each progress column
export const PROGRESS_KINDS: Record<keyof GameProgress, ProgressKind> = {
  translation_progress: 'translation',
  editing_progress: 'editing',
  voice_progress: 'voice',
  textures_progress: 'textures',
  fonts_progress: 'fonts',
};

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
