import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const APP_NAME = 'Gerumantic Presentathus';
const APP_DESCRIPTION = 'Real-time geospatial dashboard with live asset monitoring';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectRegister: 'auto',
      registerType: 'autoUpdate',
      includeAssets: [
        'icons/pwa-192x192.png',
        'icons/pwa-512x512.png',
        'icons/pwa-maskable-192x192.png',
      ],
      manifest: {
        name: APP_NAME,
        short_name: 'Presentathus',
        description: APP_DESCRIPTION,
        theme_color: '#10161a',
        background_color: '#0b1724',
        display: 'standalone',
        orientation: 'landscape',
        start_url: '/',
        scope: '/',
        categories: ['productivity', 'navigation'],
        icons: [
          {
            src: '/icons/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/pwa-maskable-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
      devOptions: {
        enabled: true,
        suppressWarnings: true,
        navigateFallback: 'index.html',
        type: 'module',
      },
    }),
  ],

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
          proxy.on('proxyReq', (_proxyReq, req, _res) => {
            console.log('➡️  Proxying:', req.method, req.url);
          });
          proxy.on('proxyReqWs', (_proxyReq, req, socket, _options, _head) => {
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
