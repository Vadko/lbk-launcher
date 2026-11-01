import { z } from 'zod';
import { Constants, type Database } from '../lib/database.types';

const enums = Constants.public.Enums;
const timestamp = z.iso.datetime({ offset: true });

export type GameReviewOutcome = Database['public']['Enums']['review_moderation'];

export const authorIdentitySchema = z.object({
  name: z.string(),
  avatarSeed: z.string(),
});

export type ReviewAuthorIdentity = z.infer<typeof authorIdentitySchema>;

const authorSchema = z.object({
  role: z.enum(enums.review_author_role),
  // A player's server-assigned nickname or an author's team name; staff stay unnamed
  name: z.string().nullable(),
  // Seeds a player's generated avatar; authors and staff have none
  avatarSeed: z.string().nullable(),
  isMine: z.boolean(),
});

export type GameReviewAuthor = z.infer<typeof authorSchema>;

const entrySchema = z.object({
  id: z.string(),
  text: z.string(),
  createdAt: timestamp,
  editedAt: timestamp.nullable(),
  author: authorSchema,
  moderation: z.enum(enums.review_moderation).exclude(['removed']),
  // An own edit still in moderation; everyone else keeps seeing `text`
  pendingText: z.string().nullable(),
});

export type GameReviewEntry = z.infer<typeof entrySchema>;

const replySchema = entrySchema.extend({
  // The reply this one answers; null when it answers the review itself
  parentId: z.string().nullable(),
});

export type GameReviewReply = z.infer<typeof replySchema>;

// The server keeps a removed reply as a stub only while a visible reply hangs under it
const removedReplySchema = z.object({
  id: z.string(),
  parentId: z.string().nullable(),
  createdAt: timestamp,
  removed: z.literal(true),
});

export type GameReviewRemovedReply = z.infer<typeof removedReplySchema>;

export type GameReviewThreadReply = GameReviewReply | GameReviewRemovedReply;

const reviewSchema = entrySchema.extend({
  type: z.enum(enums.feedback_type),
  isPublic: z.boolean(),
  // Signed URLs that expire six hours after the page was fetched
  screenshots: z.array(z.string()),
  replies: z.array(z.union([replySchema, removedReplySchema])),
});

export type GameReview = z.infer<typeof reviewSchema>;

export const reviewsPageSchema = z.object({
  items: z.array(reviewSchema),
  total: z.number(),
  nextCursor: z.string().nullable(),
  // This machine's nickname, null until it claims one
  viewer: authorIdentitySchema.nullable(),
  // The deep-linked thread, which may sit on a page not loaded yet
  focus: reviewSchema.nullable(),
});

// Main's withFocus moves the focus thread into items before the page leaves it
export type GameReviewsPage = Omit<z.infer<typeof reviewsPageSchema>, 'focus'>;

// Matches broadcast_feedback_reply(), broadcast_review_moderation() and get_machine_review_events() in lbk-admin migration 198
export const reviewEventSchema = z.object({
  kind: z.enum(['reply', 'moderation']),
  gameId: z.string(),
  gameName: z.string(),
  feedbackId: z.string(),
  entryId: z.string(),
  parentId: z.string().nullable(),
  // A player's nickname or an author's team; staff stay unnamed
  authorName: z.string().nullable(),
  authorRole: z.enum(enums.review_author_role),
  // Null unless the entry is published
  message: z.string().nullable(),
  outcome: z.enum(enums.review_moderation),
  editRejected: z.boolean(),
  createdAt: timestamp,
  editedAt: timestamp.nullable(),
  // The server's event time, kept as sent: the catch-up resumes from it to the microsecond
  at: timestamp,
});

// A live 'review' broadcast or a catch-up item, for a reply to the viewer or a verdict on their own entry
export type ReviewEvent = z.infer<typeof reviewEventSchema>;
