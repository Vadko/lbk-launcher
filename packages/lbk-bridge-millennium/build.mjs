// ttc resolves the entry, tsconfig, .env and output from cwd, exits 0 on a bad plugin.json and checks npm for updates unless told not to.
import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
// ttc skips webkit.js silently without webkit/index.tsx, and its Babel presets resolve from this package (knip.json ignores them).
const outputs = ['index.js', 'webkit.js'].map((file) =>
  join(root, '.millennium', 'Dist', file)
);
const ttc = createRequire(import.meta.url).resolve('@steambrew/ttc/dist/index.js');

rmSync(join(root, '.millennium'), { recursive: true, force: true });
const run = spawnSync(process.execPath, [ttc, '--build', 'prod', '--no-update'], {
  cwd: root,
  stdio: 'inherit',
});
const missing = outputs.filter((file) => !existsSync(file));
if (run.status !== 0 || missing.length > 0) {
  console.error(
    `[lbk-bridge-millennium] ttc exited with ${run.status}, missing: ${missing.join(', ') || 'none'}`
  );
  process.exit(1);
}
