import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    environmentMatchGlobs: [['src/**/*.smoke.test.jsx', 'jsdom']],
    setupFiles: ['./src/testSetup.js'],
    testTimeout: 15000,
  },
  esbuild: {
    jsx: 'automatic',
  },
});