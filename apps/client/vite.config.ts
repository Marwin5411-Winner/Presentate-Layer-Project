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
        secure: false,
        rewrite: (path) => path,
      },
      // Proxy WebSocket connections
      '/ws': {
        target: 'http://localhost:3000',
        ws: true,
        changeOrigin: true,
        secure: false,
        // Ensure WebSocket upgrade headers are preserved
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('❌ Proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('➡️  Proxying:', req.method, req.url);
          });
          proxy.on('proxyReqWs', (proxyReq, req, socket, _options, _head) => {
            console.log('🔌 WebSocket proxy request:', req.url);
            socket.on('error', (err) => {
              console.error('❌ WebSocket socket error:', err);
            });
          });
          proxy.on('open', (proxySocket) => {
            console.log('✅ WebSocket proxy connection opened');
            proxySocket.on('error', (err) => {
              console.error('❌ WebSocket proxy socket error:', err);
            });
          });
          proxy.on('close', (_res, _socket, _head) => {
            console.log('🔌 WebSocket proxy connection closed');
          });
        },
      },
    },
  },

  // Optimize dependencies
  optimizeDeps: {
    include: ['mapbox-gl', 'deck.gl', '@blueprintjs/core'],
  },
});
