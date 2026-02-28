/**
 * Build spellfix1 SQLite extension for the current platform.
 * Uses SQLite headers from better-sqlite3 dependencies.
 *
 * Usage: node scripts/build-spellfix.js
 */

const { execSync } = require('node:child_process');
const { existsSync, readdirSync, statSync } = require('node:fs');
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

/**
 * On Windows, find MSVC cl.exe and the required include/lib paths
 * without relying on vcvarsall.bat (which can fail in some shell environments).
 */
function findMsvcEnv() {
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

  // Find VS installation path via vswhere
  const vsWherePath = join(programFilesX86, 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  if (!existsSync(vsWherePath)) {
    throw new Error('vswhere.exe not found. Install Visual Studio Build Tools.');
  }

  let vsPath;
  try {
    vsPath = execSync(
      `"${vsWherePath}" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`,
      { encoding: 'utf8' }
    ).trim();
  } catch {
    throw new Error('Could not find VS installation with C++ tools.');
  }

  // Find MSVC tools version
  const msvcDir = join(vsPath, 'VC', 'Tools', 'MSVC');
  if (!existsSync(msvcDir)) {
    throw new Error(`MSVC tools directory not found at ${msvcDir}`);
  }
  const msvcVersions = readdirSync(msvcDir).sort();
  const msvcVersion = msvcVersions[msvcVersions.length - 1];
  const hostArch = process.arch === 'x64' ? 'x64' : 'x86';

  const msvcBase = join(msvcDir, msvcVersion);
  const clExe = join(msvcBase, 'bin', `Host${hostArch}`, hostArch, 'cl.exe');
  if (!existsSync(clExe)) {
    throw new Error(`cl.exe not found at ${clExe}`);
  }

  // Find Windows SDK
  const sdkDir = join(programFilesX86, 'Windows Kits', '10');
  const sdkIncludeDir = join(sdkDir, 'Include');
  if (!existsSync(sdkIncludeDir)) {
    throw new Error(`Windows SDK Include directory not found at ${sdkIncludeDir}`);
  }
  const sdkVersions = readdirSync(sdkIncludeDir)
    .filter((d) => d.startsWith('10.') && existsSync(join(sdkIncludeDir, d, 'ucrt')))
    .sort();
  if (sdkVersions.length === 0) {
    throw new Error('No Windows SDK version with UCRT found.');
  }
  const sdkVersion = sdkVersions[sdkVersions.length - 1];

  const includePaths = [
    join(msvcBase, 'include'),
    join(sdkDir, 'Include', sdkVersion, 'ucrt'),
    join(sdkDir, 'Include', sdkVersion, 'shared'),
    join(sdkDir, 'Include', sdkVersion, 'um'),
  ];

  const libPaths = [
    join(msvcBase, 'lib', hostArch),
    join(sdkDir, 'Lib', sdkVersion, 'ucrt', hostArch),
    join(sdkDir, 'Lib', sdkVersion, 'um', hostArch),
  ];

  const pathDirs = [
    join(msvcBase, 'bin', `Host${hostArch}`, hostArch),
  ];

  return { clExe, includePaths, libPaths, pathDirs };
}

function isUpToDate(outFile) {
  if (!existsSync(outFile)) return false;
  const srcMtime = statSync(SRC).mtimeMs;
  const outMtime = statSync(outFile).mtimeMs;
  return outMtime > srcMtime;
}

function getOutputFile() {
  const platform = process.platform;
  if (platform === 'darwin') return join(OUT_DIR, 'spellfix.dylib');
  if (platform === 'linux') return join(OUT_DIR, 'spellfix.so');
  if (platform === 'win32') return join(OUT_DIR, 'spellfix.dll');
  return null;
}

function build() {
  if (!existsSync(SRC)) {
    throw new Error(`spellfix.c not found at ${SRC}`);
  }

  const outFile = getOutputFile();
  if (outFile && isUpToDate(outFile)) {
    console.log(`[build-spellfix] Up to date, skipping build.`);
    return;
  }

  const headersDir = findSqliteHeaders();
  const platform = process.platform;

  let cmd;
  let env;

  if (platform === 'darwin') {
    cmd = `cc -dynamiclib -fPIC -O2 -o "${outFile}" "${SRC}" -I "${headersDir}"`;
  } else if (platform === 'linux') {
    cmd = `cc -shared -fPIC -O2 -o "${outFile}" "${SRC}" -I "${headersDir}"`;
  } else if (platform === 'win32') {
    const msvc = findMsvcEnv();
    const allInclude = [headersDir, ...msvc.includePaths].join(';');
    const allLib = msvc.libPaths.join(';');
    const allPath = [...msvc.pathDirs, process.env.PATH || ''].join(';');

    env = { ...process.env, INCLUDE: allInclude, LIB: allLib, PATH: allPath };
    cmd = `"${msvc.clExe}" /LD /O2 "${SRC}" /Fe:"${outFile}"`;
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  console.log(`[build-spellfix] Platform: ${platform}`);
  console.log(`[build-spellfix] Headers: ${headersDir}`);
  console.log(`[build-spellfix] Output: ${outFile}`);
  console.log(`[build-spellfix] Command: ${cmd}`);

  execSync(cmd, { stdio: 'inherit', cwd: ROOT, env: env || process.env });

  if (!existsSync(outFile)) {
    throw new Error(`Build failed: ${outFile} not created`);
  }

  console.log(`[build-spellfix] Success: ${outFile}`);
}

build();
