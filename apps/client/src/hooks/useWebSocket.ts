import { useEffect, useCallback, useMemo, useState } from 'react';
import useReactWebSocket, { ReadyState } from 'react-use-websocket';
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

  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [shouldConnect, setShouldConnect] = useState(true);

  /**
   * Resolve the correct WebSocket URL for the current environment
   * Supports:
   * - Explicit VITE_WS_URL overrides
   * - Relative paths that leverage the Vite proxy in dev
   * - Falling back to the same host/port the UI was served from
   */
  const getWebSocketUrl = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const baseHost = window.location.host || window.location.hostname || 'localhost:3000';
    const normalizedHost = baseHost.replace(/^0\.0\.0\.0/, 'localhost');
    const envUrl = import.meta.env.VITE_WS_URL?.trim();

    if (envUrl) {
      // Allow full URLs (ws:// or wss://), host:port pairs, or relative paths
      if (envUrl.startsWith('ws://') || envUrl.startsWith('wss://')) {
        return envUrl;
      }

      if (envUrl.startsWith('/')) {
        return `${protocol}//${normalizedHost}${envUrl}`;
      }

      return `${protocol}//${envUrl}`;
    }

    const envPath = import.meta.env.VITE_WS_PATH?.trim();
    const path = envPath
      ? envPath.startsWith('/')
        ? envPath
        : `/${envPath}`
      : '/ws';

    return `${protocol}//${normalizedHost}${path}`;
  }, []);

  const socketUrl = useMemo(() => getWebSocketUrl(), [getWebSocketUrl]);

  const reconnectInterval = useCallback(
    (attempt: number) => Math.min(1000 * Math.pow(2, attempt), maxReconnectDelay),
    [maxReconnectDelay]
  );

  const heartbeatConfig = useMemo(() => {
    if (!heartbeatInterval) return undefined;

    return {
      message: () =>
        JSON.stringify({
          type: 'ping',
          timestamp: new Date().toISOString(),
        }),
      returnMessage: 'pong' as const,
      interval: heartbeatInterval,
      timeout: heartbeatInterval * 1.5,
    };
  }, [heartbeatInterval]);

  const {
    sendJsonMessage,
    lastMessage,
    readyState,
    getWebSocket,
  } = useReactWebSocket(socketUrl, {
    share: false,
    heartbeat: heartbeatConfig,
    shouldReconnect: () => reconnect && shouldConnect,
    reconnectAttempts: Infinity,
    reconnectInterval,
    retryOnError: true,
    onOpen: () => {
      console.log('✅ WebSocket connected successfully');
      setConnectionState('connected');
      onOpen?.();
    },
    onClose: (event) => {
      console.log(`🔌 WebSocket disconnected (code: ${event.code}, reason: ${event.reason || 'none'})`);
      setConnectionState('disconnected');
      onClose?.();
    },
    onError: (event) => {
      console.error('❌ WebSocket error:', event);
      setConnectionState('error');
      onError?.(event);
    },
  }, shouldConnect);

  /**
   * Parse incoming messages and hand them to the provided callback
   */
  useEffect(() => {
    if (!lastMessage || typeof lastMessage.data !== 'string') return;

    try {
      const parsed: WSMessage = JSON.parse(lastMessage.data);

      if (parsed.type === 'pong' || parsed.type === 'connected') {
        console.log('💓 Heartbeat received:', parsed.type);
        if (parsed.type === 'connected') {
          setConnectionState('connected');
        }
        return;
      }

      onMessage?.(parsed);
    } catch (error) {
      console.error('❌ Error parsing WebSocket message:', error);
    }
  }, [lastMessage, onMessage]);

  /**
   * Update state to reflect transitions reported by the library
   */
  useEffect(() => {
    if (readyState === ReadyState.CONNECTING) {
      setConnectionState('connecting');
    } else if (readyState === ReadyState.OPEN) {
      setConnectionState('connected');
    } else if (readyState === ReadyState.CLOSED) {
      setConnectionState((prev) => (prev === 'error' ? 'error' : 'disconnected'));
    }
  }, [readyState]);

  /**
   * Send message to WebSocket server
   */
  const send = useCallback((message: WSMessage) => {
    if (readyState !== ReadyState.OPEN) {
      console.warn('⚠️  WebSocket is not connected. Queuing message:', {
        message,
        readyState,
      });
    }

    try {
      sendJsonMessage(message);
    } catch (error) {
      console.error('❌ Failed to send WebSocket message:', error);
    }
  }, [readyState, sendJsonMessage]);

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    setShouldConnect(false);
    const socket = getWebSocket();
    if (socket) {
      socket.close(1000, 'Client disconnect');
    }
    setConnectionState('disconnected');
  }, [getWebSocket]);

  /**
   * Manually trigger a reconnect
   */
  const reconnectConnection = useCallback(() => {
    setShouldConnect(false);
    const socket = getWebSocket();
    if (socket) {
      socket.close(1000, 'Client reconnect');
    }
    setTimeout(() => {
      setConnectionState('connecting');
      setShouldConnect(true);
    }, 0);
  }, [getWebSocket]);

  return {
    send,
    disconnect,
    reconnect: reconnectConnection,
    isConnected: readyState === ReadyState.OPEN,
    connectionState,
  };
}
