import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { writeFileAtomic } from './atomic-write';
import { system32 } from './host-exec';
import { isWindows } from './platform';

// The Steam folder's ACL lets every local user read files under it; only the secret needs locking down.
export function currentUserOnlyIcaclsArgs(
  file: string,
  env: NodeJS.ProcessEnv,
  username: string
): string[] {
  const user = env.USERNAME || username;
  const account = env.USERDOMAIN ? `${env.USERDOMAIN}\\${user}` : user;
  return [file, '/inheritance:r', '/grant:r', `${account}:F`];
}

function restrictToCurrentUser(file: string): void {
  const icacls = system32('icacls.exe');
  try {
    execFileSync(
      icacls,
      currentUserOnlyIcaclsArgs(file, process.env, os.userInfo().username),
      {
        timeout: 10_000,
        windowsHide: true,
        stdio: 'ignore',
      }
    );
  } catch (error) {
    console.warn(`[SteamBridge] Failed to restrict ${file} to the current user:`, error);
  }
}

// On Windows the empty temp file is locked down first and a rename keeps its ACL, so the content is never readable by others.
export function writeUserOnlyFile(file: string, content: string | Buffer): void {
  if (!isWindows()) {
    writeFileAtomic(file, content, { mode: 0o600 });
    return;
  }
  const tmp = `${file}.lbk.tmp`;
  fs.rmSync(tmp, { force: true });
  fs.writeFileSync(tmp, '', { flag: 'wx' });
  restrictToCurrentUser(tmp);
  try {
    fs.writeFileSync(tmp, content, { flag: 'r+' });
    fs.renameSync(tmp, file);
  } catch (error) {
    fs.rmSync(tmp, { force: true });
    // A file Steam holds open refuses the rename; it is locked down before it takes the content in place.
    if (!fs.existsSync(file)) {
      throw error;
    }
    restrictToCurrentUser(file);
    fs.writeFileSync(file, content);
  }
}
