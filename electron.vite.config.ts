import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      }
    },
    build: {
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'src/main/index.ts')
        },
        external: ['better-sqlite3']
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      }
    },
    build: {
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'src/preload/index.ts')
        }
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@resources': path.resolve(__dirname, './resources'),
        '@renderer': path.resolve(__dirname, './src/renderer'),
        '@components': path.resolve(__dirname, './src/renderer/components'),
        '@store': path.resolve(__dirname, './src/renderer/store')
      }
    },
    plugins: [
      react(),
      nodePolyfills({
        include: ['path', 'stream', 'crypto', 'buffer', 'process'],
        globals: {
          Buffer: true,
          global: true,
          process: true
        }
      })
    ],
    build: {
      outDir: path.resolve(__dirname, 'out/renderer'),
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'src/renderer/index.html')
        }
      }
    },
    server: {
      port: 5173,
      hmr: {
        overlay: true
      }
    }
  }
})