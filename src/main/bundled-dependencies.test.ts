import * as fs from 'node:fs';
import * as path from 'node:path';
import { G } from '@mobily/ts-belt';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../..');
// What the main build compiles; the renderer build bundles every import anyway.
const MAIN_SOURCES = [
  'src/main/**/*.ts',
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

type Build = 'main' | 'preload';

function buildExcludes(build: Build): string[] {
  const config = fs.readFileSync(path.join(ROOT, 'electron.vite.config.ts'), 'utf8');
  const block = new RegExp(`^  ${build}: \\{$([\\s\\S]*?)^  \\},$`, 'm').exec(
    config
  )?.[1];
  if (block === undefined) {
    throw new Error(`no ${build} block in electron.vite.config.ts`);
  }
  const list = /externalizeDeps:\s*{[^}]*exclude:\s*\[([^\]]*)\]/.exec(block)?.[1] ?? '';
  return [...list.matchAll(/'([^']+)'/g)].map((match) => match[1]);
}

function packageName(specifier: string): string {
  const parts = specifier.split('?')[0].split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

function isLocal(specifier: string): boolean {
  return specifier.startsWith('.') || specifier.startsWith('@/');
}

function valueImports(file: string): string[] {
  const source = fs.readFileSync(file, 'utf8');
  return IMPORT_PATTERNS.flatMap((pattern) =>
    [...source.matchAll(pattern)].map((match) => match[1])
  );
}

function resolveLocal(from: string, specifier: string): string {
  const bare = specifier.split('?')[0];
  const base = bare.startsWith('@/')
    ? path.join(ROOT, 'src', bare.slice(2))
    : path.resolve(path.dirname(from), bare);
  const file = [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')].find(
    (candidate) => fs.statSync(candidate, { throwIfNoEntry: false })?.isFile()
  );
  if (file === undefined) {
    throw new Error(`cannot resolve ${specifier} from ${from}`);
  }
  return file;
}

function mainProcessImports(): Set<string> {
  return new Set(
    fs
      .globSync(MAIN_SOURCES, { cwd: ROOT })
      .filter((file) => !file.endsWith('.test.ts'))
      .flatMap((file) => valueImports(path.join(ROOT, file)))
      .filter((specifier) => !isLocal(specifier))
      .map(packageName)
  );
}

// The preload build has its own exclude list, so it is checked over the files its entry reaches.
function preloadImports(): Set<string> {
  const names = new Set<string>();
  const files = new Set([path.join(ROOT, 'src/preload/index.ts')]);
  for (const file of files) {
    for (const specifier of valueImports(file)) {
      if (isLocal(specifier)) {
        files.add(resolveLocal(file, specifier));
      } else {
        names.add(packageName(specifier));
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

    expect(buildExcludes('main')).toEqual(expect.arrayContaining(withBundled));
  });

  // Both builds are CJS: externalized, an ESM-only package arrives through require(esm) as a namespace, so its default import is not callable.
  it.each<[Build, () => Set<string>]>([
    ['main', mainProcessImports],
    ['preload', preloadImports],
  ])('bundles every ESM-only dependency the %s build imports', (build, imports) => {
    const imported = imports();
    expect(imported).toContain('electron');
    const esmOnly = dependencyNames().filter(
      (name) => imported.has(name) && isEsmOnly(dependencyManifest(name))
    );

    expect(buildExcludes(build)).toEqual(expect.arrayContaining(esmOnly));
  });

  // A hoisted npm placeholder has no entry file; named after a builtin (ttc's `fs`), it broke the renderer's dep pre-bundle in `pnpm dev`.
  it('installs no npm security placeholder packages', () => {
    const lockfile = fs.readFileSync(path.join(ROOT, 'pnpm-lock.yaml'), 'utf8');
    expect(lockfile.match(/^ {2}'?\S+@0\.0\.1-security'?:/gm) ?? []).toEqual([]);
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
