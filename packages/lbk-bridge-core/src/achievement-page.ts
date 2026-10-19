import { G } from '@mobily/ts-belt';
import pWaitFor from 'p-wait-for';
import { type DomTranslation, translateDom } from './achievement-page-dom';
import {
  containerRootFiber,
  findQueryClient,
  hasDehydratedFibers,
  queryClientAbove,
  reactRootFiber,
} from './achievement-page-fiber';
import { buildSourceMap, toAppStrings } from './achievement-page-sources';
import {
  type AchievementPageKind,
  type AchievementPageMatch,
  isAppId,
  matchAchievementPage,
  PAGE_GLOBAL_KEY,
} from './achievement-page-url';
import {
  type AchievementQueries,
  hookAchievementQueries,
  type QueryClient,
} from './achievement-query-cache';
import type { AchLookup, AppStrings } from './achievement-text';
import { isFn } from './steam-globals';

const PAGE_KEY = Symbol.for(PAGE_GLOBAL_KEY);
// A newer copy started in the same document disposes an older one.
const PAGE_VERSION = 1;
const POLL_MS = 50;
// Valve reports a failed hydration after 15 s; until then React may still claim any server-rendered node.
const HYDRATE_MS = 15_000;
const ISLAND_MS = 15_000;
const HIDE_MS = 1000;
// React Query notifies its observers on a later task and React renders right after.
const SETTLE_MS = 50;
const PUSH_WAIT_MS = 10_000;

// Strings for one app, or undefined when it has none; a host that answers later pushes them through provide().
export type StringsProvider = (appid: string) => Promise<unknown>;

export interface PageWindow {
  location: { href: string };
  document?: Document;
  SSR?: unknown;
}

export interface AchievementPage {
  readonly version: number;
  provide(appid: string, strings: unknown): void;
  wanted(): string[];
  onWanted(listener: (appid: string) => void): () => void;
  dispose(): void;
}

export interface AchievementPageOptions {
  provider?: StringsProvider;
  // Apps a document-start host knows to have strings, so their rows can be hidden before the first paint.
  hint?: ReadonlySet<string>;
  win?: PageWindow;
}

interface PageBehavior {
  // The page's QueryClient once React has mounted the tree that holds it.
  client(win: PageWindow): QueryClient | undefined;
  // A server-rendered tree that must finish hydrating before anything is written.
  hydrationRoot?: (win: PageWindow) => unknown;
  hide?: (appid: string) => string;
  domFallback: boolean;
}

const ssrState = (win: PageWindow) => (G.isObject(win.SSR) ? win.SSR : undefined);
const isHydrated = (win: PageWindow): boolean => ssrState(win)?.hydrated === true;
// Rows already on screen switch in place; blanking them would only add a flash.
const isParsing = (win: PageWindow): boolean => win.document?.readyState === 'loading';
const ssrRoot = (win: PageWindow): unknown =>
  reactRootFiber(ssrState(win)?.reactRoot) ??
  (win.document && containerRootFiber(win.document));

// The store mounts the island either as its own root or as a portal from the page's root.
function islandClient(island: Element | null | undefined): QueryClient | undefined {
  const content = island?.firstElementChild;
  return (
    (island && findQueryClient(containerRootFiber(island))) ??
    (content ? queryClientAbove(content) : undefined)
  );
}

const PAGE_KINDS: Record<AchievementPageKind, PageBehavior> = {
  community: {
    client: (win) => findQueryClient(ssrRoot(win)),
    hydrationRoot: ssrRoot,
    // Rows carry data-tableindex; a personal page's latest-achievement card has only its icon to go by.
    hide: (appid) =>
      `[data-tableindex]{opacity:0!important}:has(>*>*>img[src*="/images/apps/${appid}/"]){opacity:0!important}`,
    domFallback: true,
  },
  store: {
    client: (win) =>
      islandClient(win.document?.querySelector('[data-featuretarget="achievements"]')),
    domFallback: false,
  },
};

const warn = (e: unknown): void => console.warn('[LBK] achievements page', e);
const safely = (fn: () => void): void => {
  try {
    fn();
  } catch (e) {
    warn(e);
  }
};

const pageWindow = (): PageWindow => globalThis;

const isPage = (v: unknown): v is AchievementPage =>
  G.isObject(v) && G.isNumber(v.version) && isFn(v.dispose);

function findClient(
  win: PageWindow,
  behavior: PageBehavior,
  signal: AbortSignal
): Promise<QueryClient | undefined> {
  const { hydrationRoot } = behavior;
  const client = () => behavior.client(win);
  if (hydrationRoot) {
    // SSR.hydrated flips in a root effect while a Suspense boundary below can still hold server HTML.
    const hydrated = () => isHydrated(win) && !hasDehydratedFibers(hydrationRoot(win));
    return pWaitFor<void>(hydrated, {
      interval: POLL_MS,
      timeout: { milliseconds: HYDRATE_MS, fallback: () => undefined },
      signal,
    }).then(client);
  }
  // A client-rendered island mounts after the page's own scripts ran.
  return pWaitFor<QueryClient | undefined>(
    () => {
      const found = client();
      return found ? pWaitFor.resolveWith(found) : false;
    },
    { interval: POLL_MS, timeout: { milliseconds: ISLAND_MS, fallback: client }, signal }
  );
}

// An adopted sheet adds no node, so React's hydration of the document never meets it.
function hideFor(win: PageWindow, css: string): () => void {
  const doc = win.document;
  if (!doc || typeof CSSStyleSheet === 'undefined') {
    return () => undefined;
  }
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
  const timer = setTimeout(() => show(), HIDE_MS);
  const show = (): void => {
    clearTimeout(timer);
    doc.adoptedStyleSheets = doc.adoptedStyleSheets.filter((s) => s !== sheet);
  };
  return show;
}

function createPage(
  win: PageWindow,
  page: AchievementPageMatch,
  { provider, hint }: AchievementPageOptions
): AchievementPage {
  const behavior = PAGE_KINDS[page.kind];
  const abort = new AbortController();
  const data = new Map<string, AppStrings>();
  const asks = new Map<string, Promise<void>>();
  const answered = new Set<string>();
  const wakes = new Map<string, () => void>();
  const listeners = new Set<(appid: string) => void>();
  let queries: AchievementQueries | undefined;
  let dom: DomTranslation | undefined;
  let domAllowed = false;
  let show: (() => void) | undefined;

  const lookup: AchLookup = (appid, id) =>
    G.isString(id) ? data.get(String(appid))?.[id] : undefined;

  const refreshDom = (): void => {
    dom?.dispose();
    dom = undefined;
    const strings = data.get(page.appid);
    const context = ssrState(win)?.renderContext;
    if (!domAllowed || !win.document || !strings) {
      return;
    }
    const sources = buildSourceMap(
      G.isObject(context) ? context.queryData : undefined,
      page.appid,
      strings
    );
    if (sources.size > 0) {
      dom = translateDom(win.document, sources);
    }
  };

  const apply = (appid: string, raw: unknown): void => {
    if (abort.signal.aborted) {
      return;
    }
    const strings = toAppStrings(raw);
    const changed =
      !answered.has(appid) || JSON.stringify(strings) !== JSON.stringify(data.get(appid));
    answered.add(appid);
    wakes.get(appid)?.();
    if (!changed) {
      return;
    }
    if (strings) {
      data.set(appid, strings);
    } else {
      data.delete(appid);
    }
    safely(() => queries?.sync(new Set([appid])));
    if (appid === page.appid) {
      safely(refreshDom);
    }
  };

  const waitForPush = (appid: string): Promise<void> => {
    if (answered.has(appid) || abort.signal.aborted) {
      return Promise.resolve();
    }
    for (const listener of listeners) {
      safely(() => listener(appid));
    }
    return new Promise((resolve) => {
      const wake = (): void => {
        clearTimeout(timer);
        wakes.delete(appid);
        abort.signal.removeEventListener('abort', wake);
        resolve();
      };
      const timer = setTimeout(wake, PUSH_WAIT_MS);
      wakes.set(appid, wake);
      abort.signal.addEventListener('abort', wake);
    });
  };

  // One ask per app and document; a late push still lands through provide().
  const ask = (appid: string): Promise<void> => {
    const known = asks.get(appid);
    if (known) {
      return known;
    }
    const asking = (
      provider ? provider(appid).then((raw) => apply(appid, raw)) : waitForPush(appid)
    ).catch(warn);
    asks.set(appid, asking);
    return asking;
  };

  // Called for every achievements query the cache reports, so apps reached later get asked too.
  const has = (appid: unknown): boolean => {
    const id = G.isNumber(appid) || G.isString(appid) ? String(appid) : '';
    if (!isAppId(id)) {
      return false;
    }
    void ask(id);
    return data.has(id);
  };

  // At most once per document, and only before anything was written.
  const hideWhileParsing = (): void => {
    const css = behavior.hide?.(page.appid);
    const waiting = !show && !queries && !domAllowed && !abort.signal.aborted;
    if (css && waiting && isParsing(win) && !isHydrated(win)) {
      show = hideFor(win, css);
    }
  };

  const run = async (): Promise<void> => {
    const client = await findClient(win, behavior, abort.signal);
    if (abort.signal.aborted) {
      return;
    }
    if (client) {
      queries = hookAchievementQueries(client, has, lookup);
      queries.sync(null);
    } else if (behavior.domFallback) {
      domAllowed = true;
      refreshDom();
    }
  };

  const api: AchievementPage = {
    version: PAGE_VERSION,
    provide: (appid, strings) => {
      if (isAppId(appid)) {
        apply(appid, strings);
      }
    },
    wanted: () => [...asks.keys()].filter((id) => !answered.has(id)),
    onWanted(listener) {
      listeners.add(listener);
      for (const appid of api.wanted()) {
        safely(() => listener(appid));
      }
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      if (abort.signal.aborted) {
        return;
      }
      abort.abort();
      show?.();
      safely(() => queries?.dispose());
      safely(() => dom?.dispose());
      queries = undefined;
      dom = undefined;
      listeners.clear();
      if (Reflect.get(win, PAGE_KEY) === api) {
        Reflect.deleteProperty(win, PAGE_KEY);
      }
    },
  };

  if (hint?.has(page.appid)) {
    hideWhileParsing();
  }
  const ownAnswer = ask(page.appid).then(() => {
    if (data.has(page.appid)) {
      hideWhileParsing();
    } else {
      show?.();
    }
  });
  Promise.all([run(), ownAnswer]).then(
    () => setTimeout(() => show?.(), SETTLE_MS),
    (e: unknown) => {
      if (!abort.signal.aborted) {
        warn(e);
      }
      show?.();
    }
  );
  return api;
}

// Translates the achievements on a Steam page once per document; returns undefined anywhere else.
export function startAchievementPage(
  options: AchievementPageOptions = {}
): AchievementPage | undefined {
  const win = options.win ?? pageWindow();
  const prev: unknown = Reflect.get(win, PAGE_KEY);
  if (isPage(prev) && prev.version >= PAGE_VERSION) {
    return prev;
  }
  const page = matchAchievementPage(win.location.href);
  if (!page) {
    return undefined;
  }
  const disposePrev = G.isObject(prev) ? prev.dispose : undefined;
  if (isFn(disposePrev)) {
    safely(() => disposePrev.call(prev));
  }
  const api = createPage(win, page, options);
  Object.defineProperty(win, PAGE_KEY, { value: api, configurable: true });
  return api;
}
