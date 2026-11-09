import type { PluginHostState } from '@/shared/plugin-host-types';
import { useRefreshedResource } from './useRefreshedResource';

export function useSteamPluginHost(enabled = true): PluginHostState | null {
  return useRefreshedResource('pluginHostState', enabled).value ?? null;
}
