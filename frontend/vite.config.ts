import { defineConfig } from 'vite';
import path from 'path';
import react from '@vitejs/plugin-react';

const projectRoot = path.resolve(import.meta.dirname, '..');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@docs': path.resolve(projectRoot, 'docs'),
    }
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    strictPort: true,
    // Markdown documentation lives one level above the frontend package.
    fs: { allow: [projectRoot] },
  }
});
