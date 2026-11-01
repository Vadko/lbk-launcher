import { FunctionsHttpError } from '@supabase/supabase-js';

export const MACHINE_ID = 'machine-1';

export const answered = (data: Record<string, unknown>) => ({
  data: { success: true, ...data },
  error: null,
});

// The envelope every review function sends with a non-2xx status
export const refused = (code: string, status: number) => ({
  data: null,
  error: new FunctionsHttpError(
    new Response(
      JSON.stringify({ success: false, error: code, message: 'server text' }),
      {
        status,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  ),
});

// supabase-js functions.invoke as callReviewFunction uses it, so a test reads mock.calls typed
export type Invoke = (
  name: string,
  options: { body: Record<string, unknown>; timeout: number }
) => Promise<unknown>;
