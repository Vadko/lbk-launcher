// Millennium's launcher and its port-probe child are named steam_osx too but are not Steam.
export const MAC_MILLENNIUM_LAUNCHER_RE =
  /(?:\/Steam Millennium\.app\/Contents\/MacOS|\/Millennium\/runtime\/[^/]+)\/steam_osx(?=\s|$)/;

// The crashpad handler is a detached Steam Helper that may outlive the client.
export function isCrashpadHandler(args: string | null): boolean {
  return (
    !!args && /(?:^|\s)--type=crashpad-handler(?:\s|$)/.test(args.replace(/\0/g, ' '))
  );
}
