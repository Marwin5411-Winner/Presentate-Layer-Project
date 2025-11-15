import { Elysia } from 'elysia';
import { sql } from './db';
import type { WSMessage } from './types';

/**
 * WebSocket connections registry
 * Stores all active WebSocket connections for broadcasting
 */
const connections = new Set<any>();

/**
 * Broadcast a message to all connected clients
 */
export function broadcast(message: WSMessage) {
  const messageStr = JSON.stringify(message);

  connections.forEach((ws) => {
    try {
      ws.send(messageStr);
    } catch (error) {
      console.error('Error broadcasting to client:', error);
      connections.delete(ws);
    }
  });
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
    // Get assets updated since last check
    const updates = await sql`
      SELECT
        id,
        name,
        type,
        status,
        ST_AsGeoJSON(geometry)::jsonb as geometry,
        properties,
        updated_at
      FROM assets
      WHERE updated_at > ${lastCheckTime}
        AND deleted_at IS NULL
      ORDER BY updated_at DESC
    `;

    if (updates.length > 0) {
      // Broadcast each update
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
              updatedAt: asset.updatedAt,
              ...asset.properties,
            },
          },
          timestamp: new Date().toISOString(),
        });
      });

      console.log(`📡 Broadcasted ${updates.length} asset update(s)`);
    }

    lastCheckTime = new Date();
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
      connections.add(ws);
      console.log(`🔌 Client connected. Total connections: ${connections.size}`);

      // Send welcome message
      ws.send(
        JSON.stringify({
          type: 'ping',
          data: { message: 'Connected to geospatial dashboard' },
          timestamp: new Date().toISOString(),
        })
      );

      // Start polling if this is the first connection
      if (connections.size === 1) {
        startPolling();
      }
    },

    message(ws, message) {
      try {
        const data = typeof message === 'string' ? JSON.parse(message) : message;

        // Handle ping/pong
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

    close(ws) {
      connections.delete(ws);
      console.log(`🔌 Client disconnected. Total connections: ${connections.size}`);

      // Stop polling if no more connections
      if (connections.size === 0) {
        stopPolling();
      }
    },

    error(ws, error) {
      console.error('WebSocket error:', error);
      connections.delete(ws);
    },
  });

// Cleanup on process exit
process.on('SIGTERM', () => {
  stopPolling();
  connections.clear();
});

process.on('SIGINT', () => {
  stopPolling();
  connections.clear();
});
