import { z } from 'zod';
import { readJsonFile } from '@/main/utils/json-file';

// Millennium's plugin.json and Decky's plugin.json / package.json; a field of the wrong type reads as absent.
const pluginManifestSchema = z.object({
  name: z.string().optional().catch(undefined),
  version: z.string().optional().catch(undefined),
});

export type PluginManifest = z.infer<typeof pluginManifestSchema>;

export function parsePluginManifest(raw: unknown): PluginManifest | null {
  return pluginManifestSchema.safeParse(raw).data ?? null;
}

export function readPluginManifest(file: string): PluginManifest | null {
  return readJsonFile(file, pluginManifestSchema);
}
