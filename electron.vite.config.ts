import { execSync } from 'node:child_process';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'electron-vite';
import path from 'path';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { version } from './package.json';

function getRelease(): string {
  try {
    const sha = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
    return `${version}-${sha}`;
  } catch {
    return version;
  }
}

const release = getRelease();

const sentryPlugin = () =>
  sentryVitePlugin({
    authToken: process.env.SENTRY_AUTH_TOKEN,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    url: process.env.SENTRY_URL,
    release: {
      name: release,
    },
    silent: !process.env.CI,
  });

export default defineConfig({
  main: {
    define: {
      __SENTRY_RELEASE__: JSON.stringify(release),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      sourcemap: true,
      externalizeDeps: {
        exclude: ['got'],
      },
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'src/main/index.ts'),
          'db-worker': path.resolve(__dirname, 'src/main/db/db-worker.ts'),
        },
        external: ['better-sqlite3'],
      },
    },
    plugins: [sentryPlugin()],
  },
  preload: {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      sourcemap: true,
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'src/preload/index.ts'),
        },
      },
    },
    plugins: [sentryPlugin()],
  },
  renderer: {
    define: {
      __SENTRY_RELEASE__: JSON.stringify(release),
    },
    root: 'src/renderer',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@resources': path.resolve(__dirname, './resources'),
        '@renderer': path.resolve(__dirname, './src/renderer'),
        '@components': path.resolve(__dirname, './src/renderer/components'),
        '@store': path.resolve(__dirname, './src/renderer/store'),
      },
    },
    plugins: [
      react(),
      nodePolyfills({
        include: ['path', 'stream', 'crypto', 'buffer', 'process'],
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
      }),
      sentryPlugin(),
    ],
    build: {
      sourcemap: true,
      outDir: path.resolve(__dirname, 'out/renderer'),
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'src/renderer/index.html'),
        },
      },
    },
    server: {
      port: 5173,
      hmr: {
        overlay: true,
      },
    },
  },
});
