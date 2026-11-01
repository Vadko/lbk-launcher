import { z } from 'zod';
import { Constants, type Database } from '../lib/database.types';
import type { TurnstileAction } from '../main/turnstile/contract';
import {
  authorIdentitySchema,
  type GameReviewsPage,
  type ReviewAuthorIdentity,
  type ReviewEvent,
} from './game-reviews-types';

// Mirrors REVIEW_ERROR_STATUS in lbk-admin's supabase/functions/_shared/reviewErrorCodes.ts
export const REVIEW_ERROR_CODES = [
  'invalid_body',
  'invalid_hold',
  'invalid_candidate',
  'captcha_failed',
  'edit_window_closed',
  'not_owner',
  'banned',
  'edit_limit_reached',
  'thread_full',
  'not_found',
  'method_not_allowed',
  'id_conflict',
  'nickname_taken',
  'author_exists',
  'not_moderated',
  'author_required',
  'rate_limit',
  'daily_limit',
  'internal',
  'captcha_unavailable',
  'nicknames_exhausted',
] as const;

type ReviewErrorCode = (typeof REVIEW_ERROR_CODES)[number];

// Failures the launcher meets before or instead of a server answer
type ReviewLocalFailureCode = 'unreachable' | 'bad_response' | 'e2e_mode';

// retry: resend with the same id; needs-author: only a nickname helps; rejected: roll back
export type ReviewFailureKind = 'retry' | 'needs-author' | 'rejected';

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
  // A deep link's thread: the server returns it beside page 0, and main's withFocus puts it first in that page
  focusId?: string;
}

export interface ReviewReplyInput {
  // Client-made, so a resend after a lost answer cannot post twice
  id: string;
  reviewId: string;
  parentId: string | null;
  text: string;
  // The thread's visibility: main fetches a captcha token only for a public one, and the server checks it anyway
  isPublic: boolean;
}

export interface ReviewEditInput {
  id: string;
  text: string;
  isPublic: boolean;
}

export const writeResultSchema = z.object({
  id: z.string(),
  outcome: z.enum(Constants.public.Enums.review_moderation),
});

export type ReviewWriteResult = z.infer<typeof writeResultSchema>;

export const editResultSchema = writeResultSchema.extend({
  // Moderation refused the new text, so the entry keeps its published one
  editRejected: z.boolean(),
});

export type ReviewEditResult = z.infer<typeof editResultSchema>;

export const authorStateSchema = z.object({
  author: authorIdentitySchema.nullable(),
  spinsLeft: z.number(),
});

export type ReviewAuthorState = z.infer<typeof authorStateSchema>;

export interface NicknameSpinInput {
  // The machine's latest spin, whose held reels the new one keeps
  spinId: string | null;
  hold: { avatar: boolean; adjective: boolean; noun: boolean };
}

export const nicknameSpinSchema = z.object({
  spinId: z.string(),
  avatarSeed: z.string(),
  adjective: z.string(),
  noun: z.string(),
  name: z.string(),
  decoys: z.object({
    avatarSeeds: z.array(z.string()),
    adjectives: z.array(z.string()),
    nouns: z.array(z.string()),
  }),
  spinsLeft: z.number(),
});

export type NicknameSpin = z.infer<typeof nicknameSpinSchema>;

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
  allowPublish: boolean;
}

export interface FeedbackUploadUrlsInput {
  id: string;
  fileNames: string[];
}

export const feedbackUploadUrlSchema = z.object({
  fileName: z.string(),
  path: z.string(),
  signedUrl: z.string(),
});

export type FeedbackUploadUrl = z.infer<typeof feedbackUploadUrlSchema>;

// The renderer never sends a machine id or a captcha token: main adds both
export interface GameReviewsAPI {
  fetchGameReviews: (
    input: GameReviewsListInput
  ) => Promise<ReviewResult<GameReviewsPage>>;
  replyToReview: (input: ReviewReplyInput) => Promise<ReviewResult<ReviewWriteResult>>;
  editReviewEntry: (input: ReviewEditInput) => Promise<ReviewResult<ReviewEditResult>>;
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
  // Solves a token in main ahead of a public write; the renderer never sees it
  prefetchCaptcha: (action: TurnstileAction) => void;
  // A live event alone, or a catch-up page (live=false: into the list without a toast)
  onReviewEvents: (
    callback: (events: ReviewEvent[], live: boolean) => void
  ) => () => void;
  // Replays the events missed while offline through onReviewEvents
  syncReviewEvents: () => Promise<void>;
}
