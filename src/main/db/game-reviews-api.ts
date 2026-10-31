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
import { keepValid } from './keep-valid';
import { callReviewFunction } from './review-request';
import { authorIdentitySchema } from './review-schemas';
import { withFocus } from './with-focus';

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

const pageSchema: z.ZodType<GameReviewsPage> = z
  .object({
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
    // A bad focus thread costs the deep link its scroll, never the page
    focus: z
      .unknown()
      .transform((focus) =>
        focus == null
          ? null
          : (keepValid([focus], reviewSchema, 'focus threads')[0] ?? null)
      ),
  })
  .transform(withFocus);

export function fetchGameReviews({
  gameId,
  cursor,
  focusId,
}: GameReviewsListInput): Promise<ReviewResult<GameReviewsPage>> {
  const focus = cursor === null && focusId ? { focusId } : {};
  return callReviewFunction(
    'reviews?action=list',
    { gameId, cursor, ...focus },
    pageSchema
  );
}
