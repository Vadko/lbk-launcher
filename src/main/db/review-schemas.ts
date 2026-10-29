import { z } from 'zod';
import { Constants } from '../../lib/database.types';
import type {
  ReviewEditResult,
  ReviewWriteResult,
} from '../../shared/game-reviews-api-types';
import type { ReviewAuthorIdentity } from '../../shared/game-reviews-types';

export const authorIdentitySchema: z.ZodType<ReviewAuthorIdentity> = z.object({
  name: z.string(),
  avatarSeed: z.string(),
});

export const writeResultSchema: z.ZodType<ReviewWriteResult> = z.object({
  id: z.string(),
  outcome: z.enum(Constants.public.Enums.review_moderation),
});

// Functions deployed before the field answer without it, which reads as a kept edit
export const editResultSchema: z.ZodType<ReviewEditResult> = z.object({
  id: z.string(),
  outcome: z.enum(Constants.public.Enums.review_moderation),
  editRejected: z.boolean().default(false),
});
