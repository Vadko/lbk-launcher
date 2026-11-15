import * as fs from 'node:fs';
import { wineToHostPath } from './dos-path';
import { readWineRegistry, regString } from './wine-registry';

// "C:\path\app.exe" %1, or an unquoted path when it has no spaces
const HANDLER_COMMAND = /^\s*(?:"([^"]+)"|(\S+))/;

/** The host path of the program a prefix opens links of this scheme with. */
export function urlHandlerExe(prefix: string, scheme: string): string | null {
  const command = regString(
    readWineRegistry(prefix, 'system.reg'),
    `Software\\Classes\\${scheme}\\shell\\open\\command`,
    ''
  );
  const match = command === null ? null : HANDLER_COMMAND.exec(command);
  const winPath = match ? (match[1] ?? match[2]) : null;
  const hostPath = winPath ? wineToHostPath(prefix, winPath) : null;
  return hostPath && fs.existsSync(hostPath) ? hostPath : null;
}
