import { z } from 'zod';
import { Constants } from '../../lib/database.types';
import type {
  GameReviewsListInput,
  ReviewResult,
} from '../../shared/game-reviews-api-types';
import type {
  GameReview,
  GameReviewsPage,
  GameReviewThreadReply,
} from '../../shared/game-reviews-types';
import { callReviewFunction } from './review-request';
import { authorIdentitySchema } from './review-schemas';

const enums = Constants.public.Enums;

const timestamp = z.iso.datetime({ offset: true });

const entryFields = {
  id: z.string(),
  text: z.string(),
  createdAt: timestamp,
  editedAt: timestamp.nullable(),
  author: z.object({
    role: z.enum(enums.review_author_role),
    name: z.string().nullable(),
    avatarSeed: z.string().nullable(),
    isMine: z.boolean(),
  }),
  moderation: z.enum(enums.review_moderation).exclude(['removed']),
  pendingText: z.string().nullable(),
};

const replySchema: z.ZodType<GameReviewThreadReply> = z.union([
  z.object({ ...entryFields, parentId: z.string().nullable() }),
  z.object({
    id: z.string(),
    parentId: z.string().nullable(),
    createdAt: timestamp,
    removed: z.literal(true),
  }),
]);

// One bad entry is dropped instead of failing the whole page, and the drop reaches Sentry
function keepValid<T>(items: unknown[], schema: z.ZodType<T>, what: string): T[] {
  const results = items.map((item) => schema.safeParse(item));
  const kept = results.flatMap((result) => (result.success ? [result.data] : []));
  const dropped = results.find((result) => !result.success);
  if (dropped && !dropped.success) {
    console.error(
      `[Reviews] Dropped ${items.length - kept.length} of ${items.length} ${what}:`,
      z.prettifyError(dropped.error)
    );
  }
  return kept;
}

// Malformed data would otherwise reach render and take the whole window down
const reviewSchema: z.ZodType<GameReview> = z.object({
  ...entryFields,
  type: z.enum(enums.feedback_type),
  isPublic: z.boolean(),
  screenshots: z.array(z.string()),
  replies: z
    .array(z.unknown())
    .transform((items) => keepValid(items, replySchema, 'replies')),
});

const pageSchema: z.ZodType<GameReviewsPage> = z.object({
  items: z.array(z.unknown()).transform((items, ctx) => {
    const kept = keepValid(items, reviewSchema, 'threads');
    // Every thread failing is a contract break, which must not read as a game without reviews
    if (items.length > 0 && kept.length === 0) {
      ctx.issues.push({
        code: 'custom',
        message: 'Every thread failed its schema',
        input: items,
      });
      return z.NEVER;
    }
    return kept;
  }),
  total: z.number(),
  nextCursor: z.string().nullable(),
  viewer: authorIdentitySchema.nullable(),
});

export function fetchGameReviews({
  gameId,
  cursor,
}: GameReviewsListInput): Promise<ReviewResult<GameReviewsPage>> {
  return callReviewFunction('reviews?action=list', { gameId, cursor }, pageSchema);
}
