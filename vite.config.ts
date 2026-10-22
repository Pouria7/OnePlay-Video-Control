/// <reference types="vitest" />
import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    minify: false, // Keep readable for inspection/debugging
    rollupOptions: {
      input: {
        popup: path.resolve(__dirname, 'src/popup/popup.html')
      },
      output: {
        entryFileNames: 'popup/[name].js',
        chunkFileNames: 'popup/[name].js',
        assetFileNames: 'popup/[name].[ext]'
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.ts']
  }
});
