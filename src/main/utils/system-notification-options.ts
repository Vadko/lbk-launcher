import { z } from 'zod';
import type {
  GameLinkTarget,
  SystemNotificationOptions,
} from '../../shared/game-link-target';

// A malformed review id costs only the deep link, never the notification
const targetSchema: z.ZodType<GameLinkTarget> = z.object({
  gameId: z.string().min(1),
  feedbackId: z.guid().optional().catch(undefined),
  entryId: z.guid().optional().catch(undefined),
});

const optionsSchema: z.ZodType<SystemNotificationOptions> = z.object({
  title: z.string(),
  body: z.string(),
  target: targetSchema.optional().catch(undefined),
});

export function parseSystemNotificationOptions(
  raw: unknown
): SystemNotificationOptions | null {
  const options = optionsSchema.safeParse(raw);
  return options.success ? options.data : null;
}
