import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // Proxy API and WebSocket requests to the backend server
  server: {
    port: 5173,
    proxy: {
      // Proxy API requests to Elysia server
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // Proxy WebSocket connections
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
        changeOrigin: true,
      },
    },
  },

  // Optimize dependencies
  optimizeDeps: {
    include: ['mapbox-gl', 'deck.gl', '@blueprintjs/core'],
  },
});
