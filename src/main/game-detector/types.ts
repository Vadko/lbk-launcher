import type { Database } from '../../lib/database.types';
import type { WinePrefixRef } from '../../shared/wine-types';

export interface GamePath {
  platform: Database['public']['Enums']['install_source'];
  path: string;
  exists: boolean;
  wine?: WinePrefixRef;
}
