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

export interface InvokeCall {
  name: string;
  body: Record<string, unknown>;
  timeout: number;
}

export function invokeCalls(calls: unknown[][]): InvokeCall[] {
  return calls.map(([name, options]) => {
    const { body, timeout } = options as Omit<InvokeCall, 'name'>;
    return { name: String(name), body, timeout };
  });
}
