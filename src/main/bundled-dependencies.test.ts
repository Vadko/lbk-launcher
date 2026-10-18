import * as fs from 'node:fs';
import * as path from 'node:path';
import { G } from '@mobily/ts-belt';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../..');
// What the main and preload builds compile; the renderer build bundles every import anyway.
const MAIN_SOURCES = [
  'src/main/**/*.ts',
  'src/preload/**/*.ts',
  'src/shared/**/*.ts',
  'src/lib/**/*.ts',
  'packages/lbk-bridge-core/src/**/*.ts',
];
const IMPORT_PATTERNS = [
  /^import\s+(?!type\b)[^;]*?\sfrom\s+'([^']+)'/gm,
  /^import\s+'([^']+)'/gm,
  /(?<!typeof )\bimport\(\s*'([^']+)'\s*\)/g,
];

type Manifest = Record<string, unknown>;

function readManifest(file: string): Manifest {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Manifest;
}

function dependencyNames(): string[] {
  return Object.keys(
    readManifest(path.join(ROOT, 'package.json')).dependencies as Record<string, string>
  );
}

function dependencyManifest(name: string): Manifest {
  return readManifest(path.join(ROOT, 'node_modules', name, 'package.json'));
}

function mainBuildExcludes(): string[] {
  const config = fs.readFileSync(path.join(ROOT, 'electron.vite.config.ts'), 'utf8');
  const list = /externalizeDeps:\s*{[^}]*exclude:\s*\[([^\]]*)\]/.exec(config)?.[1] ?? '';
  return [...list.matchAll(/'([^']+)'/g)].map((match) => match[1]);
}

function packageName(specifier: string): string {
  const parts = specifier.split('?')[0].split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

function mainProcessImports(): Set<string> {
  const files = fs
    .globSync(MAIN_SOURCES, { cwd: ROOT })
    .filter((file) => !file.endsWith('.test.ts'));
  const names = new Set<string>();
  for (const file of files) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const pattern of IMPORT_PATTERNS) {
      for (const [, specifier] of source.matchAll(pattern)) {
        if (!specifier.startsWith('.') && !specifier.startsWith('@/')) {
          names.add(packageName(specifier));
        }
      }
    }
  }
  return names;
}

function hasCondition(entry: unknown, condition: string): boolean {
  if (Array.isArray(entry)) {
    return entry.some((item) => hasCondition(item, condition));
  }
  return (
    G.isObject(entry) &&
    Object.entries(entry).some(
      ([key, value]) => key === condition || hasCondition(value, condition)
    )
  );
}

function entryFiles(entry: unknown): string[] {
  if (typeof entry === 'string') {
    return [entry];
  }
  if (Array.isArray(entry)) {
    return entry.flatMap(entryFiles);
  }
  return G.isObject(entry)
    ? Object.entries(entry).flatMap(([key, value]) =>
        key === 'types' ? [] : entryFiles(value)
      )
    : [];
}

function isEsmOnly(manifest: Manifest): boolean {
  const { exports } = manifest;
  const root =
    G.isObject(exports) && Object.keys(exports).some((key) => key.startsWith('.'))
      ? exports['.']
      : (exports ?? manifest.main);
  if (hasCondition(root, 'require')) {
    return false;
  }
  const files = entryFiles(root);
  return manifest.type === 'module'
    ? !files.some((file) => file.endsWith('.cjs'))
    : files.length > 0 && files.every((file) => file.endsWith('.mjs'));
}

describe('production dependencies', () => {
  // electron-builder strips a dependency's node_modules, and with it bundledDependencies.
  it('bundles every dependency that ships bundledDependencies into the main build', () => {
    const withBundled = dependencyNames().filter((name) => {
      const manifest = dependencyManifest(name);
      const bundled = manifest.bundledDependencies ?? manifest.bundleDependencies;
      return Array.isArray(bundled) ? bundled.length > 0 : bundled === true;
    });

    expect(mainBuildExcludes()).toEqual(expect.arrayContaining(withBundled));
  });

  // The main build is CJS: externalized, an ESM-only package arrives through require(esm) as a namespace, so its default import is not callable.
  it('bundles every ESM-only dependency the main process imports', () => {
    const imported = mainProcessImports();
    expect(imported).toContain('electron');
    const esmOnly = dependencyNames().filter(
      (name) => imported.has(name) && isEsmOnly(dependencyManifest(name))
    );

    expect(mainBuildExcludes()).toEqual(expect.arrayContaining(esmOnly));
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
