import { G } from '@mobily/ts-belt';
import { isFn, type SteamGlobals } from './steam-globals';

interface WebpackRequire {
  (id: string): unknown;
  m?: Record<string, unknown>;
}

// Steam's webpack runtime hands its require to any chunk pushed onto webpackChunksteamui.
export function steamWebpackRequire(g: SteamGlobals): WebpackRequire | null {
  let req: WebpackRequire | null = null;
  const chunks = g.window?.webpackChunksteamui;
  if (!G.isArray(chunks)) {
    throw new TypeError('webpackChunksteamui is not an array');
  }
  chunks.push([
    [Symbol('lbk')],
    {},
    (r: WebpackRequire) => {
      req = r;
    },
  ]);
  return req;
}

interface ExportSpec<T> {
  marker: string;
  pred: (v: unknown) => v is T;
}

type FoundExports<S> = { [K in keyof S]?: S[K] extends ExportSpec<infer T> ? T : never };

function matchingExport(mod: unknown, pred: (v: unknown) => boolean): unknown {
  const exports = G.isObject(mod) || isFn(mod) ? mod : {};
  for (const k of Object.keys(exports)) {
    try {
      const value: unknown = Reflect.get(exports, k);
      if (pred(value)) {
        return value;
      }
    } catch {
      // Lazy getters can throw before their module finishes initialising.
    }
  }
  return undefined;
}

// One pass over the module sources: stringifying the ~16 MB bundle is the expensive part.
export function findWebpackExports<S extends Record<string, ExportSpec<unknown>>>(
  req: WebpackRequire | null,
  specs: S
): FoundExports<S> {
  const found: Record<string, unknown> = {};
  const modules = req?.m;
  if (!req || !modules) {
    return found as FoundExports<S>;
  }
  const pending = new Set(Object.keys(specs));
  for (const id of Object.keys(modules)) {
    if (pending.size === 0) {
      break;
    }
    let source = '';
    try {
      source = String(modules[id]);
    } catch {
      continue;
    }
    for (const name of [...pending]) {
      if (!source.includes(specs[name].marker)) {
        continue;
      }
      let mod: unknown;
      try {
        mod = req(id);
      } catch {
        break;
      }
      const value = matchingExport(mod, specs[name].pred);
      if (value !== undefined) {
        found[name] = value;
        pending.delete(name);
      }
    }
  }
  return found as FoundExports<S>;
}
