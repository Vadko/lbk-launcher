import type { Database } from '../lib/database.types';

type Enums = Database['public']['Enums'];

export type GameReviewOutcome = Enums['review_moderation'];

type GameReviewModeration = Exclude<GameReviewOutcome, 'removed'>;

export interface ReviewAuthorIdentity {
  name: string;
  avatarSeed: string;
}

export interface GameReviewAuthor {
  role: Enums['review_author_role'];
  // A player's server-assigned nickname or an author's team name; staff stay unnamed
  name: string | null;
  // Seeds a player's generated avatar; authors and staff have none
  avatarSeed: string | null;
  isMine: boolean;
}

export interface GameReviewEntry {
  id: string;
  text: string;
  createdAt: string;
  editedAt: string | null;
  author: GameReviewAuthor;
  moderation: GameReviewModeration;
  // An own edit still in moderation; everyone else keeps seeing `text`
  pendingText: string | null;
}

export interface GameReviewReply extends GameReviewEntry {
  // The reply this one answers; null when it answers the review itself
  parentId: string | null;
}

// The server keeps a removed reply as a stub only while a visible reply hangs under it
export interface GameReviewRemovedReply {
  id: string;
  parentId: string | null;
  createdAt: string;
  removed: true;
}

export type GameReviewThreadReply = GameReviewReply | GameReviewRemovedReply;

export interface GameReview extends GameReviewEntry {
  type: Enums['feedback_type'];
  isPublic: boolean;
  // Signed URLs that expire six hours after the page was fetched
  screenshots: string[];
  replies: GameReviewThreadReply[];
}

export interface GameReviewsPage {
  items: GameReview[];
  total: number;
  nextCursor: string | null;
  // This machine's nickname, null until it claims one
  viewer: ReviewAuthorIdentity | null;
}
