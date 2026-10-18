import type { MillenniumOsDriver } from './driver';
import { linuxDriver } from './linux';
import { macDriver } from './macos';
import type { MillenniumOs } from './release';
import { windowsDriver } from './windows';

export const MILLENNIUM_DRIVERS: Record<MillenniumOs, MillenniumOsDriver> = {
  windows: windowsDriver,
  linux: linuxDriver,
  macos: macDriver,
};
