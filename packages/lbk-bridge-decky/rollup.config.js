import { readFile } from 'node:fs/promises';
import deckyPlugin from '@decky/rollup';

const RAW = '?raw';

// Vite's ?raw for this build: the core's page IIFE goes into the bundle as a string that the CDP injector evaluates in Steam's web pages.
const raw = {
  name: 'lbk-raw',
  async resolveId(source, importer) {
    if (!source.endsWith(RAW)) {
      return null;
    }
    const target = await this.resolve(source.slice(0, -RAW.length), importer, {
      skipSelf: true,
    });
    return target ? `${target.id}${RAW}` : null;
  },
  async load(id) {
    if (!id.endsWith(RAW)) {
      return null;
    }
    const file = id.slice(0, -RAW.length);
    this.addWatchFile(file);
    return `export default ${JSON.stringify(await readFile(file, 'utf8'))};`;
  },
};

export default deckyPlugin({
  plugins: [raw],
  // lucide-react marks its modules "use client", which only a server-components bundler reads.
  onwarn(warning, warn) {
    if (warning.code !== 'MODULE_LEVEL_DIRECTIVE') {
      warn(warning);
    }
  },
});
