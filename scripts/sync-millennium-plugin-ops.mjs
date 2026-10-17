// Keeps both LBK Bridge builds in sync with the TS contract:
// 1. the @lbk-ops block of the Millennium plugin from STEAM_OPS_SOURCE,
// 2. the plugin VERSION and the plugin.json / package.json versions from MILLENNIUM_PLUGIN_VERSION,
// 3. the whole @lbk-core block from the Millennium plugin into the Decky plugin.
// Usage: node scripts/sync-millennium-plugin-ops.mjs [--check]
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const opsFile = join(root, 'src/main/utils/steam-bridge-ops.ts');
const millenniumFile = join(root, 'resources/millennium-plugin/lbk-bridge/frontend/index.js');
const millenniumJson = join(root, 'resources/millennium-plugin/lbk-bridge/plugin.json');
const deckyFile = join(root, 'resources/decky-plugin/lbk-bridge/frontend/index.js');
const deckyPackage = join(root, 'resources/decky-plugin/lbk-bridge/package.json');

const OPS_BEGIN = '/* @lbk-ops:begin */\n';
const OPS_END = '\n/* @lbk-ops:end */';
const CORE_BEGIN = '/* @lbk-core:begin */\n';
const CORE_END = '\n/* @lbk-core:end */';

function die(message) {
  console.error(message);
  process.exit(1);
}

function between(text, begin, end, file) {
  const start = text.indexOf(begin);
  const stop = start === -1 ? -1 : text.indexOf(end, start + begin.length - 1);
  if (start === -1 || stop === -1 || text.indexOf(begin, start + 1) !== -1) {
    die(`${begin.trim()} … ${end.trim()} markers not found exactly once in ${file}`);
  }
  return { start: start + begin.length, stop };
}

function replaceBetween(text, begin, end, body, file) {
  const { start, stop } = between(text, begin, end, file);
  // An empty block has the begin marker's newline directly before the end marker's.
  const tail = start > stop ? text.slice(start - 1) : text.slice(stop);
  return text.slice(0, start) + body + tail;
}

function replaceOnce(text, pattern, replacement, file) {
  const matches = text.match(new RegExp(pattern.source, 'g'));
  if (!matches || matches.length !== 1) {
    die(`${pattern} must match exactly once in ${file}`);
  }
  return text.replace(pattern, replacement);
}

const opsTs = readFileSync(opsFile, 'utf8');
// String.raw with no backticks or ${ inside: the literal's text is exactly its value.
const opsMatch = opsTs.match(/export const STEAM_OPS_SOURCE = String\.raw`([^`]*)`;/);
if (!opsMatch) {
  die(`STEAM_OPS_SOURCE not found in ${opsFile}`);
}
const source = opsMatch[1];
if (source.includes('${')) {
  die('STEAM_OPS_SOURCE must not contain ${');
}
const versionMatch = opsTs.match(/export const MILLENNIUM_PLUGIN_VERSION = '(\d+\.\d+\.\d+)';/);
if (!versionMatch) {
  die(`MILLENNIUM_PLUGIN_VERSION not found in ${opsFile}`);
}
const version = versionMatch[1];

const outputs = new Map();
const read = (file) => outputs.get(file) ?? readFileSync(file, 'utf8');

let millennium = read(millenniumFile);
millennium = replaceBetween(millennium, OPS_BEGIN, OPS_END, `const OPS = ${source};`, millenniumFile);
const core = between(millennium, CORE_BEGIN, CORE_END, millenniumFile);
const coreText = millennium.slice(core.start, core.stop);
const versioned = replaceOnce(
  coreText,
  /const VERSION = '[^']*';/,
  `const VERSION = '${version}';`,
  millenniumFile
);
millennium = millennium.slice(0, core.start) + versioned + millennium.slice(core.stop);
outputs.set(millenniumFile, millennium);

outputs.set(
  deckyFile,
  replaceBetween(read(deckyFile), CORE_BEGIN, CORE_END, versioned, deckyFile)
);

for (const file of [millenniumJson, deckyPackage]) {
  outputs.set(
    file,
    replaceOnce(read(file), /"version": "[^"]*"/, `"version": "${version}"`, file)
  );
}

const stale = [...outputs].filter(([file, next]) => readFileSync(file, 'utf8') !== next);
if (process.argv.includes('--check')) {
  if (stale.length > 0) {
    die(
      `Out of date: ${stale.map(([file]) => relative(root, file)).join(', ')}; ` +
        'run node scripts/sync-millennium-plugin-ops.mjs'
    );
  }
  console.log('LBK Bridge plugins are up to date');
} else if (stale.length === 0) {
  console.log('LBK Bridge plugins already up to date');
} else {
  for (const [file, next] of stale) {
    writeFileSync(file, next);
    console.log(`Updated ${relative(root, file)}`);
  }
}
