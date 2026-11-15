import { F } from '@mobily/ts-belt';
import { enumerateKeysSafe, HKEY } from 'registry-js';
import { isWindows } from './platform';

// Every Wine prefix has HKLM\Software\Wine; CrossOver also passes its bottle and Wine its host home into the environment.
export const isRunningUnderWine = F.once(
  (): boolean =>
    isWindows() &&
    (Boolean(process.env.CX_BOTTLE || process.env.WINE_HOST_HOME) ||
      enumerateKeysSafe(HKEY.HKEY_LOCAL_MACHINE, 'Software\\Wine').length > 0)
);
