import path from 'path';
import { isWindows } from '../utils/platform';

export const WINDOWS_INSTALLER_EXTENSIONS = ['.exe', '.msi', '.bat', '.cmd'];

const EXECUTABLE_EXTENSIONS = [
  ...WINDOWS_INSTALLER_EXTENSIONS,
  '.sh',
  '.run',
  '.bin',
  '.appimage',
];

/**
 * Check if file is an executable installer
 */
export function isExecutableInstaller(fileName: string): boolean {
  const lowerName = fileName.toLowerCase();
  if (EXECUTABLE_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
    return true;
  }
  // Unix installers often ship as an extensionless ELF binary or a shebang
  // script; the kernel runs both once the exec bit is set. Windows cannot.
  return !isWindows() && path.extname(path.basename(lowerName)) === '';
}
