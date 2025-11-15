import { useState, useEffect, useCallback } from 'react';
import { fetchAssets } from '../utils/api';
import { useWebSocket } from './useWebSocket';
import type { GeoJSONFeatureCollection, GeoJSONFeature, WSMessage } from '../types';

/**
 * Custom hook for managing assets data with real-time updates
 */
export function useAssets() {
  const [data, setData] = useState<GeoJSONFeatureCollection>({
    type: 'FeatureCollection',
    features: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load initial data
  const loadAssets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const assets = await fetchAssets();
      setData(assets);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load assets'));
      console.error('Error loading assets:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle real-time updates from WebSocket
  const handleWebSocketMessage = useCallback((message: WSMessage) => {
    if (message.type === 'asset_create' && message.data) {
      const newFeature: GeoJSONFeature = message.data;

      setData((prevData) => {
        // Check if feature already exists (avoid duplicates)
        const exists = prevData.features.some((f) => f.id === newFeature.id);

        if (!exists) {
          return {
            type: 'FeatureCollection',
            features: [...prevData.features, newFeature],
          };
        }

        return prevData;
      });
    } else if (message.type === 'asset_update' && message.data) {
      const updatedFeature: GeoJSONFeature = message.data;

      setData((prevData) => {
        // Find existing feature
        const existingIndex = prevData.features.findIndex(
          (f) => f.id === updatedFeature.id
        );

        if (existingIndex >= 0) {
          // Update existing feature
          const newFeatures = [...prevData.features];
          newFeatures[existingIndex] = updatedFeature;

          return {
            type: 'FeatureCollection',
            features: newFeatures,
          };
        } else {
          // Feature not found, add it as new
          return {
            type: 'FeatureCollection',
            features: [...prevData.features, updatedFeature],
          };
        }
      });
    } else if (message.type === 'asset_delete' && message.data?.id) {
      setData((prevData) => ({
        type: 'FeatureCollection',
        features: prevData.features.filter((f) => f.id !== message.data.id),
      }));
    }
  }, []);

  // Set up WebSocket connection
  useWebSocket({
    onMessage: handleWebSocketMessage,
    onOpen: () => console.log('📡 Real-time updates connected'),
    onError: (error) => console.error('WebSocket error:', error),
  });

  // Load initial data on mount
  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  return {
    data,
    loading,
    error,
    refresh: loadAssets,
  };
}
