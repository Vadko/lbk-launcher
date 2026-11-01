import { z } from 'zod';

// One bad item is dropped instead of failing the whole answer, and the drop reaches Sentry
export function keepValid<T>(items: unknown[], schema: z.ZodType<T>, what: string): T[] {
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
