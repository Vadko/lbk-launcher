import { F, G, R } from '@mobily/ts-belt';
import pLimit, { type LimitFunction } from 'p-limit';
import pTimeout from 'p-timeout';
import { isAchievementPageOrigin, isAppId } from './achievement-page-url';
import type { AppStrings } from './achievement-text';
import {
  browserUrl,
  CDP_HOST,
  type CdpParams,
  contextOf,
  isAchievementSite,
  isPlaceholder,
  type TargetInfo,
  toTargetInfo,
} from './page-injector-cdp';
import { BINDING, documentSource, PROVIDE } from './page-injector-scripts';
import { abortableDelay, type BridgeSocket, SOCKET_OPEN } from './socket';

const COMMAND_TIMEOUT_MS = 10_000;
const RETRY_MIN_MS = 2000;
// Every retry reads /json/version through Decky's proxy, which logs each request.
const RETRY_MAX_MS = 120_000;
// A document opened on a profile's games list asks once per game it reaches client-side; the cap only stops a flood.
const MAX_ASKS_PER_CONTEXT = 256;

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
  // Apps with strings: a document of theirs hides its achievement rows from its start until they are translated.
  setHint(appids: Iterable<string>): void;
  dispose(): void;
}

// The main world of an achievements page and the apps it asked for.
interface PageContext {
  // Chrome reuses context ids across renderer processes; this one names a single document.
  uniqueId: string;
  asked: Set<string>;
}

interface Session {
  targetId: string;
  contexts: Map<number, PageContext>;
  // The document-start script Chrome holds for this session, swapped one at a time.
  script: { identifier: string; source: string } | null;
  scripts: LimitFunction;
}

// One attach attempt; a newer attempt or a detach replaces it in the target map.
interface Attachment {
  sessionId: string | null;
}

// Decky's host for the page module (Millennium has webkit.js): evaluates it in every document on the achievements sites over CDP and answers its asks.
export function createPageInjector({
  env,
  script,
  strings,
}: PageInjectorOptions): PageInjector {
  const life = new AbortController();
  let source = documentSource(script, []);
  // Re-registers the document-start script on the live connection's sessions.
  let rehint: (() => void) | null = null;
  const warned = new Set<string>();
  let started = false;
  let socket: BridgeSocket | null = null;

  const warnOnce = (kind: string, detail?: unknown): void => {
    if (!warned.has(kind)) {
      warned.add(kind);
      console.warn(`[LBK] achievement pages: ${kind}`, detail ?? '');
    }
  };

  const delay = abortableDelay(env, life.signal);

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

      // Remove, then add without awaiting the removal: a page keeps the first hint it reads, and no document may start between the two with no script.
      const register = (sessionId: string, session: Session): Promise<void> =>
        session.scripts(async () => {
          const wanted = source;
          const old = session.script;
          if (old?.source === wanted || sessions.get(sessionId) !== session) {
            return;
          }
          session.script = null;
          const removed = old
            ? send(
                'Page.removeScriptToEvaluateOnNewDocument',
                { identifier: old.identifier },
                sessionId
              )
            : undefined;
          const added = send(
            'Page.addScriptToEvaluateOnNewDocument',
            { source: wanted },
            sessionId
          );
          const [, res] = await Promise.all([removed, added]);
          if (!G.isObject(res) || !G.isString(res.identifier)) {
            throw new Error('no script identifier');
          }
          session.script = { identifier: res.identifier, source: wanted };
        });

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
        const session: Session = {
          targetId,
          contexts: new Map(),
          script: null,
          scripts: pLimit(1),
        };
        sessions.set(sessionId, session);
        // New contexts get the binding only while Runtime is enabled.
        await Promise.all([
          send('Runtime.enable', {}, sessionId),
          send('Runtime.addBinding', { name: BINDING }, sessionId),
          send('Page.enable', {}, sessionId),
          register(sessionId, session),
        ]);
        // The document already open; it may be gone by now.
        await send('Runtime.evaluate', { expression: source }, sessionId).catch(F.ignore);
      };

      const failed =
        (targetId: string, attempt: Attachment, kind: string) => (e: unknown) => {
          if (ws.readyState === SOCKET_OPEN) {
            warnOnce(kind, e);
          }
          if (targets.get(targetId) === attempt) {
            detach(targetId);
          }
        };

      const attach = (targetId: string): void => {
        const attempt: Attachment = { sessionId: null };
        targets.set(targetId, attempt);
        setUp(targetId, attempt).catch(failed(targetId, attempt, 'attach failed'));
      };

      const rehintSessions = (): void => {
        for (const [sessionId, session] of sessions) {
          const attempt = targets.get(session.targetId);
          if (attempt?.sessionId === sessionId) {
            register(sessionId, session).catch(
              failed(session.targetId, attempt, 'hint update failed')
            );
          }
        }
      };
      rehint = rehintSessions;

      // A session kept through Steam's placeholders still runs the script in the next achievements page; any other page ends it.
      const consider = (info: TargetInfo): void => {
        const known = targets.has(info.targetId);
        if (!known && isAchievementSite(info)) {
          attach(info.targetId);
        } else if (known && !isAchievementSite(info) && !isPlaceholder(info)) {
          detach(info.targetId);
        }
      };

      const answer = (sessionId: string, session: Session, params: CdpParams): void => {
        const { name, payload, executionContextId: contextId } = params;
        if (
          name !== BINDING ||
          !G.isNumber(contextId) ||
          !G.isString(payload) ||
          !isAppId(payload)
        ) {
          return;
        }
        const context = session.contexts.get(contextId);
        if (
          !context ||
          context.asked.has(payload) ||
          context.asked.size >= MAX_ASKS_PER_CONTEXT
        ) {
          return;
        }
        context.asked.add(payload);
        strings(payload)
          .then((found) => {
            // strings() can take a while; the document that asked may be gone by then.
            if (
              sessions.get(sessionId) !== session ||
              session.contexts.get(contextId) !== context
            ) {
              return undefined;
            }
            return send(
              'Runtime.callFunctionOn',
              {
                functionDeclaration: PROVIDE,
                uniqueContextId: context.uniqueId,
                arguments: [{ value: payload }, { value: found ?? null }],
                returnByValue: true,
              },
              sessionId
            );
          })
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
              session.contexts.set(context.id, {
                uniqueId: context.uniqueId,
                asked: new Set(),
              });
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
        if (rehint === rehintSessions) {
          rehint = null;
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
      const url = await browserUrl(env.fetchJson).catch((e: unknown) => {
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
    setHint(appids) {
      const next = documentSource(script, appids);
      if (next !== source) {
        source = next;
        rehint?.();
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
