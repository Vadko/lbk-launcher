// ttc resolves the entry, tsconfig, .env and output from cwd, exits 0 on a bad plugin.json and checks npm for updates unless told not to.
import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const output = join(root, '.millennium', 'Dist', 'index.js');
const ttc = createRequire(import.meta.url).resolve('@steambrew/ttc/dist/index.js');

rmSync(join(root, '.millennium'), { recursive: true, force: true });
const run = spawnSync(process.execPath, [ttc, '--build', 'prod', '--no-update'], {
  cwd: root,
  stdio: 'inherit',
});
if (run.status !== 0 || !existsSync(output)) {
  console.error(`[lbk-bridge-millennium] ttc did not produce ${output}`);
  process.exit(1);
}
