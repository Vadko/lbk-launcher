/**
 * VDF (Valve Data Format) Parser
 * Using @node-steam/vdf library
 */

import * as vdf from '@node-steam/vdf';

/**
 * Parse Steam libraryfolders.vdf file
 */
export function parseLibraryFolders(content: string): string[] {
  const parsed = vdf.parse(content);
  const libraries: string[] = [];

  // The VDF structure is: "libraryfolders" -> { "0": {...}, "1": {...}, ... }
  const libraryFolders = parsed?.libraryfolders;
  if (!libraryFolders || typeof libraryFolders === 'string') return libraries;

  // Iterate through numbered entries
  for (const key in libraryFolders) {
    const entry = libraryFolders[key];
    if (
      entry &&
      typeof entry === 'object' &&
      'path' in entry &&
      typeof entry.path === 'string'
    ) {
      libraries.push(entry.path);
    }
  }

  return libraries;
}

/**
 * Parse Steam appmanifest file
 */
interface AppManifest {
  appid: string;
  name: string;
  installdir: string;
  StateFlags?: string;
  LastUpdated?: string;
}

export function parseAppManifest(content: string): AppManifest | null {
  try {
    const parsed = vdf.parse(content);
    const appState = parsed?.AppState;

    if (!appState || typeof appState === 'string') return null;

    return {
      appid: appState.appid || '',
      name: appState.name || '',
      installdir: appState.installdir || '',
      StateFlags: appState.StateFlags,
      LastUpdated: appState.LastUpdated,
    };
  } catch (error) {
    console.error('[VDFParser] Error parsing appmanifest:', error);
    return null;
  }
}
