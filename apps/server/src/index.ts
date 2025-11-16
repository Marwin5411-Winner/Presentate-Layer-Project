import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { testConnection } from './db';
import { routes } from './routes';
import { websocket, setAppInstance } from './websocket';
import { initNotificationCenter, shutdownNotificationCenter } from './notifications';

// Test database connection on startup
await testConnection();

/**
 * Main Elysia application
 * Serves the geospatial dashboard API and WebSocket server
 */
const app = new Elysia()
  // Enable CORS for development (Vite dev server on different port)
  .use(
    cors({
      origin: process.env.NODE_ENV === 'production' ? false : true,
      credentials: true,
    })
  )

  // Health check endpoint
  .get('/', () => ({
    name: 'Geospatial Dashboard API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
  }))

  // Mount API routes
  .use(routes)

  // Mount WebSocket
  .use(websocket)

  // Global error handler
  .onError(({ code, error, set }) => {
    console.error('Server error:', error);
    const errorMessage = error instanceof Error ? error.message : undefined;

    if (code === 'NOT_FOUND') {
      set.status = 404;
      return { error: 'Not Found' };
    }

    set.status = 500;
    return {
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    };
  })

  // Start server
  .listen(3000);

// Set app instance for WebSocket broadcasting
setAppInstance(app);
await initNotificationCenter();

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🗺️  Geospatial Dashboard Server');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`🦊 HTTP: http://${app.server?.hostname}:${app.server?.port}`);
console.log(`🔌 WebSocket: ws://${app.server?.hostname}:${app.server?.port}/ws`);
console.log(`📡 API: http://${app.server?.hostname}:${app.server?.port}/api`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// Gracefully shutdown notification center
process.on('SIGTERM', shutdownNotificationCenter);
process.on('SIGINT', shutdownNotificationCenter);
