import { z } from 'zod';
import type {
  GameLinkTarget,
  SystemNotificationOptions,
} from '../../shared/game-link-target';

const targetSchema: z.ZodType<GameLinkTarget> = z.object({
  gameId: z.string().min(1),
  feedbackId: z.guid().optional(),
  entryId: z.guid().optional(),
});

const optionsSchema: z.ZodType<SystemNotificationOptions> = z.object({
  title: z.string(),
  body: z.string(),
  target: targetSchema.optional(),
});

export function parseSystemNotificationOptions(
  raw: unknown
): SystemNotificationOptions | null {
  const options = optionsSchema.safeParse(raw);
  return options.success ? options.data : null;
}
