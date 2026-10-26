import type { Database } from '../lib/database.types';
import type {
  GameReviewOutcome,
  GameReviewsPage,
  ReviewAuthorIdentity,
} from './game-reviews-types';

// Mirrors REVIEW_ERROR_STATUS in lbk-admin's supabase/functions/_shared/reviewErrorCodes.ts
export type ReviewErrorCode =
  | 'invalid_body'
  | 'invalid_hold'
  | 'invalid_candidate'
  | 'captcha_failed'
  | 'edit_window_closed'
  | 'not_owner'
  | 'banned'
  | 'not_found'
  | 'method_not_allowed'
  | 'id_conflict'
  | 'nickname_taken'
  | 'author_exists'
  | 'not_moderated'
  | 'author_required'
  | 'rate_limit'
  | 'internal'
  | 'captcha_unavailable'
  | 'nicknames_exhausted';

// Failures the launcher meets before or instead of a server answer
export type ReviewLocalFailureCode =
  | 'unreachable'
  | 'bad_response'
  | 'no_machine_id'
  | 'e2e_mode';

// retry: resend with the same id; needs-*: only a nickname or a fresh captcha token helps; rejected: roll back
export type ReviewFailureKind = 'retry' | 'needs-author' | 'needs-captcha' | 'rejected';

export interface ReviewFailure {
  code: ReviewErrorCode | ReviewLocalFailureCode;
  kind: ReviewFailureKind;
}

export type ReviewResult<T> =
  | { ok: true; data: T }
  | { ok: false; failure: ReviewFailure };

export interface GameReviewsListInput {
  gameId: string;
  cursor: string | null;
}

export interface ReviewReplyInput {
  // Client-made, so a resend after a lost answer cannot post twice
  id: string;
  reviewId: string;
  parentId: string | null;
  text: string;
}

export interface ReviewEditInput {
  id: string;
  text: string;
}

export interface ReviewWriteResult {
  id: string;
  outcome: GameReviewOutcome;
}

export interface ReviewAuthorState {
  author: ReviewAuthorIdentity | null;
  spinsLeft: number;
}

export interface NicknameSpinInput {
  // The machine's latest spin, whose held reels the new one keeps
  spinId: string | null;
  hold: { avatar: boolean; adjective: boolean; noun: boolean };
}

export interface NicknameSpin {
  spinId: string;
  avatarSeed: string;
  adjective: string;
  noun: string;
  name: string;
  decoys: { avatarSeeds: string[]; adjectives: string[]; nouns: string[] };
  spinsLeft: number;
}

export interface NicknameClaimInput {
  spinId: string;
}

export interface SubmitFeedbackInput {
  // Client-made: names the screenshot folder and makes a resend idempotent
  id: string;
  gameId: string;
  type: Database['public']['Enums']['feedback_type'];
  message: string;
  screenshotPaths: string[];
}

export interface FeedbackUploadUrlsInput {
  id: string;
  fileNames: string[];
}

export interface FeedbackUploadUrl {
  fileName: string;
  path: string;
  signedUrl: string;
}

// The renderer never sends a machine id or a captcha token: main adds both
export interface GameReviewsAPI {
  fetchGameReviews: (
    input: GameReviewsListInput
  ) => Promise<ReviewResult<GameReviewsPage>>;
  replyToReview: (input: ReviewReplyInput) => Promise<ReviewResult<ReviewWriteResult>>;
  editReviewEntry: (input: ReviewEditInput) => Promise<ReviewResult<ReviewWriteResult>>;
  getReviewAuthor: () => Promise<ReviewResult<ReviewAuthorState>>;
  spinReviewNickname: (input: NicknameSpinInput) => Promise<ReviewResult<NicknameSpin>>;
  claimReviewNickname: (
    input: NicknameClaimInput
  ) => Promise<ReviewResult<ReviewAuthorIdentity>>;
  submitFeedback: (
    input: SubmitFeedbackInput
  ) => Promise<ReviewResult<ReviewWriteResult>>;
  getFeedbackUploadUrls: (
    input: FeedbackUploadUrlsInput
  ) => Promise<ReviewResult<FeedbackUploadUrl[]>>;
}
