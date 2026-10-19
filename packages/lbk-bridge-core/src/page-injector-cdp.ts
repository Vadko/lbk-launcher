import { G, R } from '@mobily/ts-belt';
import { isAchievementPageOrigin } from './achievement-page-url';

// Steam's CEF remote debugging port, the one Decky Loader itself injects through.
export const CDP_HOST = '127.0.0.1:8080';
const BROWSER_PATH = /^\/devtools\/browser\/[\w-]{1,128}$/;

export type CdpParams = Record<string, unknown>;

export interface TargetInfo {
  targetId: string;
  type: string;
  url: string;
}

const parseUrl = (url: string): URL | undefined =>
  R.toUndefined(R.fromExecution(() => new URL(url)));

// Only the path comes from /json/version, so whatever holds the port gets no other host to dial.
export async function browserUrl(
  fetchJson: (url: string) => Promise<unknown>
): Promise<string | undefined> {
  const version = await fetchJson(`http://${CDP_HOST}/json/version`);
  const raw = G.isObject(version) ? version.webSocketDebuggerUrl : undefined;
  const path = G.isString(raw) ? parseUrl(raw)?.pathname : undefined;
  return path && BROWSER_PATH.test(path) ? `ws://${CDP_HOST}${path}` : undefined;
}

export const toTargetInfo = (v: unknown): TargetInfo | undefined =>
  G.isObject(v) && G.isString(v.targetId) && G.isString(v.type) && G.isString(v.url)
    ? { targetId: v.targetId, type: v.type, url: v.url }
    : undefined;

// Other sites never get the binding, the script or Runtime events, which would stream their console into Steam's UI thread.
export const isAchievementSite = ({ type, url }: TargetInfo): boolean =>
  type === 'page' && isAchievementPageOrigin(parseUrl(url)?.origin ?? '');
export const isBlank = ({ url }: TargetInfo): boolean =>
  parseUrl(url)?.protocol === 'about:';

export const contextOf = (
  params: CdpParams
): { id: number; origin: string; uniqueId: string } | undefined => {
  const context = params.context;
  return G.isObject(context) &&
    G.isNumber(context.id) &&
    G.isString(context.origin) &&
    G.isString(context.uniqueId)
    ? { id: context.id, origin: context.origin, uniqueId: context.uniqueId }
    : undefined;
};
