import readline from 'readline';
import type { Readable } from 'stream';
import type { InstallationStatus } from '../../shared/types';

// "[ 85%] Unpacking sd (5624/8650)..." and "[1/2] Unpacking game archives..." (UXM-CLI, install.bat)
const PERCENT_LINE = /^\[\s*(\d{1,3})\s*%\]\s*(\S.*)$/;
const STEP_LINE = /^\[\d+\/\d+\]\s*\S.*$/;

export function parseInstallerProgress(line: string): InstallationStatus | null {
  const text = line.trim();
  const percent = PERCENT_LINE.exec(text);
  if (percent) {
    return {
      message: percent[2],
      progress: Math.min(Number(percent[1]), 100),
      phase: 'install',
    };
  }
  if (STEP_LINE.test(text)) {
    return { message: text, phase: 'install' };
  }
  return null;
}

/** Calls onLine for each full line; readline keeps a UTF-8 character split across chunks whole. */
export function readInstallerLines(
  stream: Readable,
  onLine: (line: string) => void
): void {
  readline.createInterface({ input: stream, crlfDelay: Infinity }).on('line', (line) => {
    const trimmed = line.trim();
    if (trimmed) {
      onLine(trimmed);
    }
  });
}

/** Logs the installer's stdout and turns its progress lines into install statuses. */
export function followInstallerOutput(
  stream: Readable,
  onStatus?: (status: InstallationStatus) => void
): void {
  readInstallerLines(stream, (line) => {
    console.log(`[Installer stdout] ${line}`);
    const status = parseInstallerProgress(line);
    if (status) {
      onStatus?.(status);
    }
  });
}
