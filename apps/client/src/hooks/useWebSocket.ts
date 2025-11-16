import { useEffect, useRef, useCallback, useState } from 'react';
import type { WSMessage } from '../types';

interface UseWebSocketOptions {
  onMessage?: (message: WSMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  reconnect?: boolean;
  maxReconnectDelay?: number;
  heartbeatInterval?: number;
}

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * Custom hook for WebSocket connection
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Connection state management
 * - Heartbeat/ping mechanism
 * - Improved error handling
 */
export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    onMessage,
    onOpen,
    onClose,
    onError,
    reconnect = true,
    maxReconnectDelay = 30000, // 30 seconds max
    heartbeatInterval = 30000, // 30 seconds
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const heartbeatTimeoutRef = useRef<number | null>(null);
  const shouldConnectRef = useRef(true);
  const reconnectAttemptsRef = useRef(0);
  const isConnectingRef = useRef(false);

  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');

  /**
   * Calculate reconnection delay with exponential backoff
   * 1s, 2s, 4s, 8s, 16s, ... up to maxReconnectDelay
   */
  const getReconnectDelay = useCallback(() => {
    const delay = Math.min(
      1000 * Math.pow(2, reconnectAttemptsRef.current),
      maxReconnectDelay
    );
    return delay;
  }, [maxReconnectDelay]);

  /**
   * Send heartbeat ping to keep connection alive
   */
  const startHeartbeat = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearInterval(heartbeatTimeoutRef.current);
    }

    heartbeatTimeoutRef.current = window.setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(
            JSON.stringify({
              type: 'ping',
              timestamp: new Date().toISOString(),
            })
          );
        } catch (error) {
          console.error('❌ Error sending heartbeat:', error);
        }
      }
    }, heartbeatInterval);
  }, [heartbeatInterval]);

  /**
   * Stop heartbeat
   */
  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearInterval(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
  }, []);

  /**
   * Connect to WebSocket server
   */
  const connect = useCallback(() => {
    // Prevent multiple simultaneous connection attempts
    if (!shouldConnectRef.current || isConnectingRef.current) {
      return;
    }

    // Close existing connection if any
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    isConnectingRef.current = true;
    setConnectionState('connecting');

    // Build WebSocket URL based on current location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    console.log(`🔌 Connecting to WebSocket: ${wsUrl} (attempt ${reconnectAttemptsRef.current + 1})`);

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('✅ WebSocket connected successfully');
        isConnectingRef.current = false;
        reconnectAttemptsRef.current = 0; // Reset reconnect attempts on success
        setConnectionState('connected');

        // Start heartbeat
        startHeartbeat();

        onOpen?.();
      };

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);

          // Handle pong responses (don't pass to callback)
          if (message.type === 'pong' || message.type === 'connected') {
            console.log('💓 Heartbeat received:', message.type);
            return;
          }

          onMessage?.(message);
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', {
          error,
          readyState: ws.readyState,
          url: wsUrl,
        });
        isConnectingRef.current = false;
        setConnectionState('error');
        onError?.(error);
      };

      ws.onclose = (event) => {
        console.log(`🔌 WebSocket disconnected (code: ${event.code}, reason: ${event.reason || 'none'})`);
        isConnectingRef.current = false;
        setConnectionState('disconnected');

        // Stop heartbeat
        stopHeartbeat();

        onClose?.();

        // Attempt to reconnect with exponential backoff
        if (reconnect && shouldConnectRef.current) {
          const delay = getReconnectDelay();
          console.log(`🔄 Reconnecting in ${delay / 1000}s... (attempt ${reconnectAttemptsRef.current + 1})`);

          reconnectTimeoutRef.current = window.setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('❌ Failed to create WebSocket:', error);
      isConnectingRef.current = false;
      setConnectionState('error');
    }
  }, [onMessage, onOpen, onClose, onError, reconnect, getReconnectDelay, startHeartbeat, stopHeartbeat]);

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    shouldConnectRef.current = false;

    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Stop heartbeat
    stopHeartbeat();

    // Close WebSocket connection
    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }

    setConnectionState('disconnected');
  }, [stopHeartbeat]);

  /**
   * Send message to WebSocket server
   */
  const send = useCallback((message: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('⚠️  WebSocket is not connected. Message not sent:', {
        message,
        state: connectionState,
        readyState: wsRef.current?.readyState,
      });
    }
  }, [connectionState]);

  // Initialize connection on mount
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    send,
    disconnect,
    reconnect: connect,
    isConnected: connectionState === 'connected',
    connectionState,
  };
}
