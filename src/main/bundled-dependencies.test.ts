import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../..');

function readManifest(file: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
}

function mainBuildExcludes(): string[] {
  const config = fs.readFileSync(path.join(ROOT, 'electron.vite.config.ts'), 'utf8');
  const list = /externalizeDeps:\s*{[^}]*exclude:\s*\[([^\]]*)\]/.exec(config)?.[1] ?? '';
  return [...list.matchAll(/'([^']+)'/g)].map((match) => match[1]);
}

describe('production dependencies', () => {
  // electron-builder strips a dependency's node_modules, and with it bundledDependencies.
  it('bundles every dependency that ships bundledDependencies into the main build', () => {
    const dependencies = readManifest(path.join(ROOT, 'package.json')).dependencies;
    const withBundled = Object.keys(dependencies as Record<string, string>).filter(
      (name) => {
        const manifest = readManifest(
          path.join(ROOT, 'node_modules', name, 'package.json')
        );
        const bundled = manifest.bundledDependencies ?? manifest.bundleDependencies;
        return Array.isArray(bundled) ? bundled.length > 0 : bundled === true;
      }
    );

    expect(mainBuildExcludes()).toEqual(expect.arrayContaining(withBundled));
  });

  // electron-vite externalizes `dependencies`; a workspace package there would be required from a missing node_modules entry.
  it('keeps workspace packages out of dependencies so they are bundled', () => {
    const dependencies = readManifest(path.join(ROOT, 'package.json')).dependencies;
    expect(
      Object.values(dependencies as Record<string, string>).filter((spec) =>
        spec.startsWith('workspace:')
      )
    ).toEqual([]);
  });
});
