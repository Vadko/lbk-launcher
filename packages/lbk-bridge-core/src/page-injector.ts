import { F, G, R } from '@mobily/ts-belt';
import pTimeout from 'p-timeout';
import { isAchievementPageOrigin } from './achievement-page-url';
import type { AppStrings } from './achievement-text';
import type { BridgeSocket } from './socket';

// Steam's CEF remote debugging port, the one Decky Loader itself injects through.
const CDP_HOST = '127.0.0.1:8080';
const BROWSER_PATH = /^\/devtools\/browser\/[\w-]{1,128}$/;
const STEAM_UI_HOST = 'steamloopback.host';
const BINDING = '__lbkAchievementStrings';
const APP_ID = /^[1-9]\d{0,9}$/;
const COMMAND_TIMEOUT_MS = 10_000;
const RETRY_MIN_MS = 2000;
// Every retry reads /json/version through Decky's proxy, which logs each request.
const RETRY_MAX_MS = 120_000;
// The page module asks once per app and document; more than this is not the page module.
const MAX_ASKS_PER_CONTEXT = 16;
const SOCKET_OPEN = 1;
const PAGE_GLOBAL = "globalThis[Symbol.for('lbk.achievementPage')]";

// Runs in the page after the page module: forwards every app it waits for to the binding, read per call because a reconnect installs a new one.
const HOOKUP = `;(() => {
  const page = ${PAGE_GLOBAL};
  if (page && typeof page.onWanted === 'function') {
    page.onWanted((appid) => {
      const ask = globalThis.${BINDING};
      if (typeof ask === 'function') {
        ask(appid);
      }
    });
  }
})();
//# sourceURL=lbk-achievement-page.js`;

// Called with CDP arguments, so the strings reach the page as values and never as source text.
const PROVIDE = `function (appid, strings) {
  const page = ${PAGE_GLOBAL};
  if (page && typeof page.provide === 'function') {
    page.provide(appid, strings);
  }
}`;

// The timers are typed as p-timeout takes them, so the injector also type-checks under Node's typings.
export interface PageInjectorEnv
  extends Pick<typeof globalThis, 'setTimeout' | 'clearTimeout'> {
  // CEF's /json endpoints send no CORS headers; Decky's no-CORS fetch reads them.
  fetchJson(url: string): Promise<unknown>;
  openSocket(url: string): BridgeSocket;
}

interface PageInjectorOptions {
  env: PageInjectorEnv;
  // The core's achievement page IIFE (dist/achievement-page.iife.js), which starts in push mode.
  script: string;
  strings(appid: string): Promise<AppStrings | undefined>;
}

export interface PageInjector {
  start(): void;
  dispose(): void;
}

interface TargetInfo {
  targetId: string;
  type: string;
  url: string;
}

type CdpParams = Record<string, unknown>;

interface Session {
  targetId: string;
  // Main worlds of achievements pages by execution context id, with the apps each asked for.
  contexts: Map<number, Set<string>>;
}

// One attach attempt; a newer attempt or a detach replaces it in the target map.
interface Attachment {
  sessionId: string | null;
}

const neverSettles = (): Promise<void> => new Promise<void>(F.ignore);

const parseUrl = (url: string): URL | undefined =>
  R.toUndefined(R.fromExecution(() => new URL(url)));

const toTargetInfo = (v: unknown): TargetInfo | undefined =>
  G.isObject(v) && G.isString(v.targetId) && G.isString(v.type) && G.isString(v.url)
    ? { targetId: v.targetId, type: v.type, url: v.url }
    : undefined;

// Steam's own UI is served from steamloopback.host (the plugin's SharedJSContext included) or lives in about:blank popups.
const isWebPage = ({ type, url }: TargetInfo): boolean => {
  const parsed = parseUrl(url);
  return (
    type === 'page' && parsed?.protocol === 'https:' && parsed.hostname !== STEAM_UI_HOST
  );
};
const isSteamUi = ({ url }: TargetInfo): boolean =>
  parseUrl(url)?.hostname === STEAM_UI_HOST;

const contextOf = (params: CdpParams): { id: number; origin: string } | undefined => {
  const context = params.context;
  return G.isObject(context) && G.isNumber(context.id) && G.isString(context.origin)
    ? { id: context.id, origin: context.origin }
    : undefined;
};

// Decky's host for the page module (Millennium has webkit.js): evaluates it in every document of Steam's web pages over CDP and answers its asks.
export function createPageInjector({
  env,
  script,
  strings,
}: PageInjectorOptions): PageInjector {
  const life = new AbortController();
  const source = `${script}\n${HOOKUP}`;
  const warned = new Set<string>();
  let started = false;
  let socket: BridgeSocket | null = null;

  const warnOnce = (kind: string, detail?: unknown): void => {
    if (!warned.has(kind)) {
      warned.add(kind);
      console.warn(`[LBK] achievement pages: ${kind}`, detail ?? '');
    }
  };

  const delay = (ms: number): Promise<void> =>
    pTimeout(neverSettles(), {
      milliseconds: ms,
      message: false,
      customTimers: env,
      signal: life.signal,
    }).catch(F.ignore);

  // Only the path comes from the answer, so whatever holds the port gets no other host to dial.
  const browserUrl = async (): Promise<string | undefined> => {
    const version = await env.fetchJson(`http://${CDP_HOST}/json/version`);
    const raw = G.isObject(version) ? version.webSocketDebuggerUrl : undefined;
    const path = G.isString(raw) ? parseUrl(raw)?.pathname : undefined;
    return path && BROWSER_PATH.test(path) ? `ws://${CDP_HOST}${path}` : undefined;
  };

  // Resolves once the socket closes, with whether target discovery started on it.
  const connect = (url: string): Promise<boolean> =>
    new Promise<boolean>((resolve) => {
      const ws = env.openSocket(url);
      socket = ws;
      let seq = 0;
      let discovering = false;
      const replies = new Map<number, { ok(v: unknown): void; fail(e: Error): void }>();
      const targets = new Map<string, Attachment>();
      const sessions = new Map<string, Session>();

      const send = (method: string, params: CdpParams, sessionId?: string) => {
        if (ws.readyState !== SOCKET_OPEN) {
          return Promise.reject(new Error('socket closed'));
        }
        seq += 1;
        const id = seq;
        const reply = new Promise<unknown>((ok, fail) => replies.set(id, { ok, fail }));
        ws.send(
          JSON.stringify(
            sessionId ? { id, method, params, sessionId } : { id, method, params }
          )
        );
        return pTimeout(reply, {
          milliseconds: COMMAND_TIMEOUT_MS,
          message: `${method} timed out`,
          customTimers: env,
        }).finally(() => replies.delete(id));
      };

      const forget = (targetId: string): void => {
        const sessionId = targets.get(targetId)?.sessionId;
        targets.delete(targetId);
        if (sessionId) {
          sessions.delete(sessionId);
        }
      };

      const detach = (targetId: string): void => {
        const sessionId = targets.get(targetId)?.sessionId;
        forget(targetId);
        if (sessionId) {
          send('Target.detachFromTarget', { sessionId }).catch(F.ignore);
        }
      };

      const setUp = async (targetId: string, attempt: Attachment): Promise<void> => {
        const res = await send('Target.attachToTarget', { targetId, flatten: true });
        const sessionId =
          G.isObject(res) && G.isString(res.sessionId) ? res.sessionId : null;
        if (!sessionId) {
          throw new Error('no session id');
        }
        if (targets.get(targetId) !== attempt) {
          await send('Target.detachFromTarget', { sessionId });
          return;
        }
        attempt.sessionId = sessionId;
        sessions.set(sessionId, { targetId, contexts: new Map() });
        // New contexts get the binding only while Runtime is enabled.
        await Promise.all([
          send('Runtime.enable', {}, sessionId),
          send('Runtime.addBinding', { name: BINDING }, sessionId),
          send('Page.enable', {}, sessionId),
          send('Page.addScriptToEvaluateOnNewDocument', { source }, sessionId),
        ]);
        // The document already open; it may be gone by now.
        await send('Runtime.evaluate', { expression: source }, sessionId).catch(F.ignore);
      };

      const attach = (targetId: string): void => {
        const attempt: Attachment = { sessionId: null };
        targets.set(targetId, attempt);
        setUp(targetId, attempt).catch((e: unknown) => {
          if (ws.readyState === SOCKET_OPEN) {
            warnOnce('attach failed', e);
          }
          if (targets.get(targetId) === attempt) {
            detach(targetId);
          }
        });
      };

      // Only Steam UI ends a session: one kept through about:blank still runs the script in the next web page.
      const consider = (info: TargetInfo): void => {
        const known = targets.has(info.targetId);
        if (!known && isWebPage(info)) {
          attach(info.targetId);
        } else if (known && isSteamUi(info)) {
          detach(info.targetId);
        }
      };

      const answer = (sessionId: string, session: Session, params: CdpParams): void => {
        const { name, payload, executionContextId: contextId } = params;
        const asked = G.isNumber(contextId) ? session.contexts.get(contextId) : undefined;
        if (
          name !== BINDING ||
          !asked ||
          !G.isString(payload) ||
          !APP_ID.test(payload) ||
          asked.has(payload) ||
          asked.size >= MAX_ASKS_PER_CONTEXT
        ) {
          return;
        }
        asked.add(payload);
        strings(payload)
          .then((found) =>
            send(
              'Runtime.callFunctionOn',
              {
                functionDeclaration: PROVIDE,
                executionContextId: contextId,
                arguments: [{ value: payload }, { value: found ?? null }],
                returnByValue: true,
              },
              sessionId
            )
          )
          .catch(F.ignore);
      };

      const onSessionEvent = (sessionId: string, method: string, params: CdpParams) => {
        const session = sessions.get(sessionId);
        if (!session) {
          return;
        }
        switch (method) {
          case 'Runtime.bindingCalled':
            answer(sessionId, session, params);
            break;
          case 'Runtime.executionContextCreated': {
            const context = contextOf(params);
            // Only an achievements page's own origin gets strings, so another site in Steam's browser cannot list them.
            if (context && isAchievementPageOrigin(context.origin)) {
              session.contexts.set(context.id, new Set());
            }
            break;
          }
          case 'Runtime.executionContextDestroyed':
            if (G.isNumber(params.executionContextId)) {
              session.contexts.delete(params.executionContextId);
            }
            break;
          case 'Runtime.executionContextsCleared':
            session.contexts.clear();
            break;
          default:
            break;
        }
      };

      const onBrowserEvent = (method: string, params: CdpParams): void => {
        switch (method) {
          case 'Target.targetCreated':
          case 'Target.targetInfoChanged': {
            const info = toTargetInfo(params.targetInfo);
            if (info) {
              consider(info);
            }
            break;
          }
          case 'Target.targetDestroyed':
            if (G.isString(params.targetId)) {
              forget(params.targetId);
            }
            break;
          case 'Target.detachedFromTarget': {
            const session = G.isString(params.sessionId)
              ? sessions.get(params.sessionId)
              : undefined;
            if (session) {
              forget(session.targetId);
            }
            break;
          }
          default:
            break;
        }
      };

      const onMessage = (msg: unknown): void => {
        if (!G.isObject(msg)) {
          return;
        }
        if (G.isNumber(msg.id)) {
          const reply = replies.get(msg.id);
          if (G.isObject(msg.error)) {
            reply?.fail(new Error(String(msg.error.message)));
          } else {
            reply?.ok(msg.result);
          }
          return;
        }
        if (!G.isString(msg.method)) {
          return;
        }
        const params = G.isObject(msg.params) ? msg.params : {};
        if (G.isString(msg.sessionId)) {
          onSessionEvent(msg.sessionId, msg.method, params);
        } else {
          onBrowserEvent(msg.method, params);
        }
      };

      const closed = (): void => {
        life.signal.removeEventListener('abort', closed);
        if (socket === ws) {
          socket = null;
        }
        for (const reply of replies.values()) {
          reply.fail(new Error('socket closed'));
        }
        replies.clear();
        resolve(discovering);
      };
      life.signal.addEventListener('abort', closed, { once: true });

      ws.onopen = () => {
        send('Target.setDiscoverTargets', { discover: true }).then(
          () => {
            discovering = true;
          },
          (e: unknown) => {
            warnOnce('target discovery failed', e);
            ws.close();
          }
        );
      };
      ws.onmessage = (ev) =>
        onMessage(
          R.toUndefined(R.fromExecution((): unknown => JSON.parse(String(ev.data))))
        );
      ws.onerror = () => {
        if (!discovering) {
          warnOnce('cannot open the CDP socket');
        }
      };
      ws.onclose = closed;
    });

  const run = async (): Promise<void> => {
    let retryMs = RETRY_MIN_MS;
    while (!life.signal.aborted) {
      const url = await browserUrl().catch((e: unknown) => {
        warnOnce('cannot read /json/version', e);
        return null;
      });
      if (url === undefined) {
        warnOnce(`no CEF browser endpoint on ${CDP_HOST}`);
      } else if (url && !life.signal.aborted && (await connect(url))) {
        retryMs = RETRY_MIN_MS;
      }
      if (life.signal.aborted) {
        return;
      }
      await delay(retryMs);
      retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
    }
  };

  return {
    start() {
      if (!started && !life.signal.aborted) {
        started = true;
        void run();
      }
    },
    dispose() {
      if (life.signal.aborted) {
        return;
      }
      const ws = socket;
      socket = null;
      life.abort();
      try {
        ws?.close(1000, 'disposed');
      } catch {
        // Already closing.
      }
    },
  };
}
