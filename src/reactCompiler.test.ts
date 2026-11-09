import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { transformSync } from 'oxc-transform-react';
import { describe, expect, it } from 'vitest';

// The renderer build compiles these, src/shared through the renderer's imports
const COMPILED_DIRS = ['renderer', 'shared'];

const sources = COMPILED_DIRS.flatMap((dir) =>
  readdirSync(path.join(import.meta.dirname, dir), { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$|\.d\.ts$/.test(file))
    .map((file) => path.join(dir, file))
);

// The Rust compiler still reports the library on a list that opts out with 'use no memo'
const isOptedOut = (source: string, message: string) =>
  message.startsWith('Use of incompatible library') && source.includes("'use no memo'");

const failuresIn = (file: string): string[] => {
  const source = readFileSync(path.join(import.meta.dirname, file), 'utf8');
  const { errors } = transformSync(file, source, {
    lang: file.endsWith('.tsx') ? 'tsx' : 'ts',
    jsx: 'preserve',
    reactCompiler: { reportDiagnostics: true },
  });
  return errors
    .filter((error) => !isOptedOut(source, error.message))
    .map((error) => `${file}: ${error.message.split('\n')[0]}`);
};

// Lint does not see syntax the compiler cannot lower yet, and such a component ships unmemoized
describe('React Compiler', () => {
  it('compiles every component and hook the renderer ships', { timeout: 60_000 }, () => {
    expect(sources.flatMap(failuresIn)).toEqual([]);
  });
});
