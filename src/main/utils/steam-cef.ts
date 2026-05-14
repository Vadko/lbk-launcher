/**
 * Steam CEF (Chromium Embedded Framework) remote debugging client.
 *
 * Steam exposes its CEF DevTools protocol on http://localhost:8080 when the
 * marker file `.cef-enable-remote-debugging` exists in the Steam user data
 * folder. The `SharedJSContext` target (a hidden tab) is where Steam's
 * frontend mounts the `window.SteamClient` global and internal stores like
 * `m_mapMyAchievements`. We use this to apply changes (launch options,
 * achievement strings) live without restarting Steam.
 *
 * Built on `chrome-remote-interface`, the canonical Node CDP client used by
 * the broader Chrome DevTools ecosystem. Decky Loader connects to the same
 * endpoint from its Python backend.
 */

import CDP from 'chrome-remote-interface';

const CEF_HOST = 'localhost';
const CEF_PORT = 8080;
const TARGET_TITLE = 'SharedJSContext';
const CEF_PROBE_TIMEOUT_MS = 1500;
const CEF_EVAL_TIMEOUT_MS = 8000;

/**
 * Race a promise against a timeout. `chrome-remote-interface` doesn't expose
 * a per-call timeout, and if Steam's CEF process is mid-shutdown / wedged the
 * underlying socket can hang indefinitely.
 */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Quick HTTP probe of the CEF debug endpoint. Returns false fast so we don't
 * stall startup or the install flow when Steam isn't running or the flag file
 * isn't set.
 */
export async function isCefAvailable(): Promise<boolean> {
  try {
    await withTimeout(
      CDP.Version({ host: CEF_HOST, port: CEF_PORT }),
      CEF_PROBE_TIMEOUT_MS,
      'CEF probe'
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Open a single-use CDP session against SharedJSContext and run one
 * `Runtime.evaluate`. The expression is wrapped so it can `await`; the result
 * is returned by value (CDP otherwise returns object handles for non-primitive
 * results).
 */
export async function evaluateInSharedJsContext<T = unknown>(
  expression: string
): Promise<T> {
  const client = await withTimeout(
    CDP({
      host: CEF_HOST,
      port: CEF_PORT,
      target: (targets) => targets.find((t) => t.title === TARGET_TITLE) ?? targets[0],
    }),
    CEF_EVAL_TIMEOUT_MS,
    'CEF connect'
  );

  try {
    const result = await withTimeout(
      client.Runtime.evaluate({
        expression: `(async () => { return (${expression}); })()`,
        awaitPromise: true,
        returnByValue: true,
      }),
      CEF_EVAL_TIMEOUT_MS,
      'CEF evaluate'
    );
    if (result.exceptionDetails) {
      throw new Error(`CEF expression threw: ${JSON.stringify(result.exceptionDetails)}`);
    }
    return (result.result?.value as T) ?? (undefined as T);
  } finally {
    await client.close().catch(() => {
      // Closing an already-closed session throws; safe to ignore.
    });
  }
}
