import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');
const common = {
  bundle: true,
  format: 'iife',
  target: 'es2020',
  logLevel: watch ? 'info' : 'warning',
};
const builds = [
  // LBK wraps this one in an arrow that returns __lbkOps.ops, keeping the name off Steam's window.
  {
    ...common,
    entryPoints: ['src/ops-cdp.ts'],
    globalName: '__lbkOps',
    outfile: 'dist/steam-ops.iife.js',
  },
  // Runs in Steam web pages and is reached only through its Symbol.for global, so it declares no name.
  {
    ...common,
    entryPoints: ['src/achievement-page-entry.ts'],
    outfile: 'dist/achievement-page.iife.js',
  },
];

if (watch) {
  for (const options of builds) {
    await (await esbuild.context(options)).watch();
  }
} else {
  await Promise.all(builds.map((options) => esbuild.build(options)));
}
