import { FunctionsHttpError } from '@supabase/supabase-js';

/**
 * Хелпери для роботи з помилками supabase Edge Functions.
 *
 * supabase.functions.invoke() на не-2xx кидає FunctionsHttpError, у якого
 * `context` — це сирий Response. Вбудованого способу дістати статус/тіло
 * немає, тож читаємо самі.
 */

/** HTTP-статус з помилки edge function (для 4xx-гілок), або undefined. */
export function functionsErrorStatus(error: unknown): number | undefined {
  return error instanceof FunctionsHttpError
    ? (error.context as Response).status
    : undefined;
}

/**
 * Прочитати статус + JSON-тіло з помилки edge function (напр. деталі
 * rate-limit на 429). Повертає null, якщо це не HTTP-помилка функції.
 */
export async function readFunctionsErrorBody(
  error: unknown
): Promise<{ status: number; body: Record<string, unknown> } | null> {
  if (!(error instanceof FunctionsHttpError)) {
    return null;
  }
  const response = error.context as Response;
  try {
    return { status: response.status, body: await response.json() };
  } catch {
    return { status: response.status, body: {} };
  }
}
