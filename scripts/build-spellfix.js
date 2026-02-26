/**
 * Build spellfix1 SQLite extension for the current platform.
 * Uses SQLite headers from better-sqlite3 dependencies.
 *
 * Usage: node scripts/build-spellfix.js
 */

const { execSync } = require('node:child_process');
const { existsSync, readdirSync } = require('node:fs');
const { join, resolve } = require('node:path');

const ROOT = resolve(__dirname, '..');
const SRC = join(ROOT, 'resources', 'extensions', 'spellfix.c');
const OUT_DIR = join(ROOT, 'resources', 'extensions');

// Find better-sqlite3 SQLite headers (works with pnpm hoisted layout)
function findSqliteHeaders() {
  const pnpmDir = join(ROOT, 'node_modules', '.pnpm');
  if (!existsSync(pnpmDir)) {
    throw new Error('node_modules/.pnpm not found. Run pnpm install first.');
  }

  const entries = readdirSync(pnpmDir).filter((e) => e.startsWith('better-sqlite3@'));
  if (entries.length === 0) {
    throw new Error('better-sqlite3 not found in node_modules/.pnpm');
  }

  const depsPath = join(pnpmDir, entries[0], 'node_modules', 'better-sqlite3', 'deps', 'sqlite3');
  if (!existsSync(join(depsPath, 'sqlite3ext.h'))) {
    throw new Error(`sqlite3ext.h not found at ${depsPath}`);
  }

  return depsPath;
}

function build() {
  if (!existsSync(SRC)) {
    throw new Error(`spellfix.c not found at ${SRC}`);
  }

  const headersDir = findSqliteHeaders();
  const platform = process.platform;

  let cmd;
  let outFile;

  if (platform === 'darwin') {
    outFile = join(OUT_DIR, 'spellfix.dylib');
    cmd = `cc -dynamiclib -fPIC -O2 -o "${outFile}" "${SRC}" -I "${headersDir}"`;
  } else if (platform === 'linux') {
    outFile = join(OUT_DIR, 'spellfix.so');
    cmd = `cc -shared -fPIC -O2 -o "${outFile}" "${SRC}" -I "${headersDir}"`;
  } else if (platform === 'win32') {
    outFile = join(OUT_DIR, 'spellfix.dll');
    cmd = `cl /LD /O2 /I "${headersDir}" "${SRC}" /Fe:"${outFile}"`;
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  console.log(`[build-spellfix] Platform: ${platform}`);
  console.log(`[build-spellfix] Headers: ${headersDir}`);
  console.log(`[build-spellfix] Output: ${outFile}`);
  console.log(`[build-spellfix] Command: ${cmd}`);

  execSync(cmd, { stdio: 'inherit', cwd: ROOT });

  if (!existsSync(outFile)) {
    throw new Error(`Build failed: ${outFile} not created`);
  }

  console.log(`[build-spellfix] Success: ${outFile}`);
}

build();
