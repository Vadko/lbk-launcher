import type { Database } from '../../lib/database.types';

export interface GamePath {
  platform: Database['public']['Enums']['install_source'];
  path: string;
  exists: boolean;
}
