import { Elysia } from 'elysia';
import { sql } from './db';
import type { WSMessage } from './types';

/**
 * Topic name for WebSocket pub/sub
 */
const ASSETS_TOPIC = 'assets-updates';

/**
 * Track active subscriber count
 */
let subscriberCount = 0;

/**
 * Store reference to the Elysia app instance for global publishing
 */
let appInstance: Elysia | null = null;

/**
 * Set the app instance for broadcasting
 */
export function setAppInstance(app: Elysia) {
  appInstance = app;
}

/**
 * Broadcast a message to all connected clients using Elysia's pub/sub
 */
export function broadcast(message: WSMessage) {
  if (!appInstance?.server) {
    console.warn('Cannot broadcast: server instance not available');
    return;
  }

  const messageStr = JSON.stringify(message);
  appInstance.server.publish(ASSETS_TOPIC, messageStr);
}

/**
 * Poll database for changes and broadcast updates
 * This is a simple polling mechanism - for production,
 * consider using PostgreSQL LISTEN/NOTIFY for better performance
 */
let lastCheckTime = new Date();
const POLL_INTERVAL = 5000; // 5 seconds

async function pollForUpdates() {
  try {
    const currentTime = new Date();

    // Get assets created since last check (created_at equals updated_at for new records)
    const created = await sql`
      SELECT
        id,
        name,
        type,
        status,
        ST_AsGeoJSON(geometry)::jsonb as geometry,
        properties,
        created_at,
        updated_at
      FROM assets
      WHERE created_at > ${lastCheckTime}
        AND created_at = updated_at
        AND deleted_at IS NULL
      ORDER BY created_at DESC
    `;

    if (created.length > 0) {
      created.forEach((asset) => {
        broadcast({
          type: 'asset_create',
          data: {
            type: 'Feature',
            id: asset.id,
            geometry: asset.geometry,
            properties: {
              id: asset.id,
              name: asset.name,
              type: asset.type,
              status: asset.status,
              createdAt: asset.created_at,
              updatedAt: asset.updated_at,
              ...asset.properties,
            },
          },
          timestamp: new Date().toISOString(),
        });
      });

      console.log(`📡 Broadcasted ${created.length} asset creation(s)`);
    }

    // Get assets updated since last check (updated_at > created_at for modified records)
    const updates = await sql`
      SELECT
        id,
        name,
        type,
        status,
        ST_AsGeoJSON(geometry)::jsonb as geometry,
        properties,
        created_at,
        updated_at
      FROM assets
      WHERE updated_at > ${lastCheckTime}
        AND updated_at > created_at
        AND deleted_at IS NULL
      ORDER BY updated_at DESC
    `;

    if (updates.length > 0) {
      updates.forEach((asset) => {
        broadcast({
          type: 'asset_update',
          data: {
            type: 'Feature',
            id: asset.id,
            geometry: asset.geometry,
            properties: {
              id: asset.id,
              name: asset.name,
              type: asset.type,
              status: asset.status,
              createdAt: asset.created_at,
              updatedAt: asset.updated_at,
              ...asset.properties,
            },
          },
          timestamp: new Date().toISOString(),
        });
      });

      console.log(`📡 Broadcasted ${updates.length} asset update(s)`);
    }

    // Get assets deleted since last check
    const deleted = await sql`
      SELECT id
      FROM assets
      WHERE deleted_at > ${lastCheckTime}
        AND deleted_at IS NOT NULL
      ORDER BY deleted_at DESC
    `;

    if (deleted.length > 0) {
      deleted.forEach((asset) => {
        broadcast({
          type: 'asset_delete',
          data: {
            id: asset.id,
          },
          timestamp: new Date().toISOString(),
        });
      });

      console.log(`📡 Broadcasted ${deleted.length} asset deletion(s)`);
    }

    lastCheckTime = currentTime;
  } catch (error) {
    console.error('Error polling for updates:', error);
  }
}

// Start polling when this module is loaded
let pollTimer: Timer | null = null;

export function startPolling() {
  if (pollTimer) return;

  console.log('📡 Started WebSocket update polling');
  pollTimer = setInterval(pollForUpdates, POLL_INTERVAL);
}

export function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    console.log('📡 Stopped WebSocket update polling');
  }
}

/**
 * WebSocket plugin for Elysia
 */
export const websocket = new Elysia()
  .ws('/ws', {
    open(ws) {
      // Subscribe to the assets updates topic
      ws.subscribe(ASSETS_TOPIC);
      subscriberCount++;

      console.log(`🔌 Client connected. Total subscribers: ${subscriberCount}`);

      // Send welcome message
      ws.send(
        JSON.stringify({
          type: 'connected',
          data: { message: 'Connected to geospatial dashboard' },
          timestamp: new Date().toISOString(),
        })
      );

      // Start polling if this is the first connection
      if (subscriberCount === 1) {
        startPolling();
      }
    },

    message(ws, message) {
      try {
        const data = typeof message === 'string' ? JSON.parse(message) : message;

        // Handle ping/pong for connection keepalive
        if (data.type === 'ping') {
          ws.send(
            JSON.stringify({
              type: 'pong',
              timestamp: new Date().toISOString(),
            })
          );
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    },

    close(ws, code, message) {
      // Unsubscribe from the topic
      ws.unsubscribe(ASSETS_TOPIC);
      subscriberCount = Math.max(0, subscriberCount - 1);

      console.log(`🔌 Client disconnected (code: ${code}). Total subscribers: ${subscriberCount}`);

      // Stop polling if no more connections
      if (subscriberCount === 0) {
        stopPolling();
      }
    },

    error(ws, error) {
      console.error('❌ WebSocket error:', error);
      // Clean up the connection
      ws.unsubscribe(ASSETS_TOPIC);
      subscriberCount = Math.max(0, subscriberCount - 1);
    },
  });

// Cleanup on process exit
process.on('SIGTERM', () => {
  stopPolling();
  subscriberCount = 0;
});

process.on('SIGINT', () => {
  stopPolling();
  subscriberCount = 0;
});
