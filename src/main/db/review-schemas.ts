import { z } from 'zod';
import { Constants } from '../../lib/database.types';
import type { ReviewWriteResult } from '../../shared/game-reviews-api-types';
import type { ReviewAuthorIdentity } from '../../shared/game-reviews-types';

export const authorIdentitySchema: z.ZodType<ReviewAuthorIdentity> = z.object({
  name: z.string(),
  avatarSeed: z.string(),
});

export const writeResultSchema: z.ZodType<ReviewWriteResult> = z.object({
  id: z.string(),
  outcome: z.enum(Constants.public.Enums.review_moderation),
});
