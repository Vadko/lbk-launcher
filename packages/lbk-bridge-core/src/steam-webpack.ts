import { isFn, isRecord, type SteamGlobals } from './steam-globals';

interface WebpackRequire {
  (id: string): unknown;
  m?: Record<string, unknown>;
}

// Steam's webpack runtime hands its require to any chunk pushed onto webpackChunksteamui.
export function steamWebpackRequire(g: SteamGlobals): WebpackRequire | null {
  let req: WebpackRequire | null = null;
  const chunks = g.window?.webpackChunksteamui;
  if (!Array.isArray(chunks)) {
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

export function findWebpackExport<T>(
  req: WebpackRequire | null,
  marker: string,
  pred: (v: unknown) => v is T
): T | undefined {
  const modules = req?.m;
  if (!req || !modules) {
    return undefined;
  }
  for (const id of Object.keys(modules)) {
    let mod: unknown;
    try {
      if (!String(modules[id]).includes(marker)) {
        continue;
      }
      mod = req(id);
    } catch {
      continue;
    }
    const exports = isRecord(mod) || isFn(mod) ? mod : {};
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
  }
  return undefined;
}
