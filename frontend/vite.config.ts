import { defineConfig } from 'vite';
import path from 'path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@docs': path.resolve(__dirname, '..', 'docs'), // farol/frontend -> farol/docs
    }
  },
  server: {
    port: 5173,
    host: '0.0.0.0'
  }
});
