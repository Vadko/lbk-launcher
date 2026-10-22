import { z } from 'zod';
import { readJsonFile } from '../utils/json-file';

const optionalId = z
  .string()
  .nullish()
  .transform((value) => value ?? undefined);

const epicManifestSchema = z
  .object({
    InstallLocation: z.string().min(1),
    DisplayName: z.string().min(1),
    CatalogNamespace: optionalId,
    CatalogItemId: optionalId,
    AppName: optionalId,
    MainGameAppName: optionalId,
  })
  .transform((manifest) => ({
    installLocation: manifest.InstallLocation,
    displayName: manifest.DisplayName,
    catalogNamespace: manifest.CatalogNamespace,
    catalogItemId: manifest.CatalogItemId,
    appName: manifest.AppName,
    mainGameAppName: manifest.MainGameAppName,
  }));

export function parseEpicManifest(manifestPath: string) {
  return readJsonFile(manifestPath, epicManifestSchema);
}
