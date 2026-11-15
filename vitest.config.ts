import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@resources': path.resolve(__dirname, './resources'),
    },
  },
  test: {
    environment: 'node',
    // A local .env with VITE_ADMIN_MODE=true would make hidden games visible in every query test
    env: { VITE_ADMIN_MODE: '' },
    include: ['src/**/*.test.ts', 'packages/*/src/**/*.test.ts'],
  },
});
