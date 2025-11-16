import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { staticPlugin } from '@elysiajs/static';
import { testConnection } from './db';
import { routes } from './routes';
import { websocket, setAppInstance } from './websocket';
import * as path from 'path';

// Test database connection on startup
await testConnection();

const PORT = process.env.PORT || 3000;
const CLIENT_DIST = path.join(import.meta.dir, '../../client/dist');

/**
 * Production Elysia application
 * Serves both the API and the static frontend files
 */
const app = new Elysia()
  // Enable CORS
  .use(
    cors({
      origin: process.env.CORS_ORIGIN || true,
      credentials: true,
    })
  )

  // Mount API routes FIRST (before static files)
  .use(routes)

  // Mount WebSocket
  .use(websocket)

  // Serve static files from client/dist
  .use(
    staticPlugin({
      assets: CLIENT_DIST,
      prefix: '/',
    })
  )

  // Fallback for SPA - serve index.html for any unmatched routes
  .get('*', ({ set }) => {
    set.headers['content-type'] = 'text/html';
    return Bun.file(path.join(CLIENT_DIST, 'index.html'));
  })

  // Global error handler
  .onError(({ code, error, set }) => {
    console.error('Server error:', error);

    if (code === 'NOT_FOUND') {
      set.status = 404;
      return { error: 'Not Found' };
    }

    set.status = 500;
    return {
      error: 'Internal Server Error',
    };
  })

  // Start server
  .listen(PORT);

// Set app instance for WebSocket broadcasting
setAppInstance(app);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🗺️  Geospatial Dashboard (Production)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`🌐 Server: http://${app.server?.hostname}:${app.server?.port}`);
console.log(`📂 Serving: ${CLIENT_DIST}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
