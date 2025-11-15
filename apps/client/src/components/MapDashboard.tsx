import { useState, useCallback } from 'react';
import Map from 'react-map-gl/mapbox';
import { DeckGL } from '@deck.gl/react';
import { GeoJsonLayer } from '@deck.gl/layers';
import type { PickingInfo } from '@deck.gl/core';
import type { GeoJSONFeatureCollection, GeoJSONFeature, ViewState } from '../types';
import 'mapbox-gl/dist/mapbox-gl.css';

interface MapDashboardProps {
  data: GeoJSONFeatureCollection;
  onFeatureClick?: (feature: GeoJSONFeature) => void;
  visibleLayers?: Set<string>;
}

// Default view state (San Francisco)
const INITIAL_VIEW_STATE: ViewState = {
  latitude: 37.7749,
  longitude: -122.4194,
  zoom: 12,
  pitch: 0,
  bearing: 0,
};

// Mapbox token - in production, this should come from environment variables
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

/**
 * Color mapping for different asset types and statuses
 */
const getFeatureColor = (feature: GeoJSONFeature): [number, number, number, number] => {
  const { type, status } = feature.properties;

  // Status-based colors (override type colors)
  if (status === 'critical') return [220, 38, 38, 200]; // Red
  if (status === 'warning') return [234, 179, 8, 200]; // Yellow

  // Type-based colors
  switch (type) {
    case 'vehicle':
      return [59, 130, 246, 200]; // Blue
    case 'incident':
      return [239, 68, 68, 200]; // Red
    case 'poi':
      return [34, 197, 94, 200]; // Green
    case 'zone':
      return [168, 85, 247, 100]; // Purple (semi-transparent for polygons)
    case 'route':
      return [249, 115, 22, 200]; // Orange
    default:
      return [156, 163, 175, 200]; // Gray
  }
};

/**
 * Get point radius based on asset type
 */
const getPointRadius = (feature: GeoJSONFeature): number => {
  const { type, status } = feature.properties;

  if (status === 'critical') return 12;
  if (status === 'warning') return 10;

  switch (type) {
    case 'vehicle':
      return 8;
    case 'incident':
      return 10;
    case 'poi':
      return 6;
    default:
      return 5;
  }
};

/**
 * Get line width for routes
 */
const getLineWidth = (feature: GeoJSONFeature): number => {
  return feature.properties.type === 'route' ? 3 : 2;
};

export function MapDashboard({ data, onFeatureClick, visibleLayers }: MapDashboardProps) {
  const [viewState, setViewState] = useState<ViewState>(INITIAL_VIEW_STATE);
  const [hoverInfo, setHoverInfo] = useState<PickingInfo | null>(null);

  // Filter data based on visible layers
  const filteredData: GeoJSONFeatureCollection = {
    type: 'FeatureCollection',
    features: visibleLayers
      ? data.features.filter((f) => visibleLayers.has(f.properties.type))
      : data.features,
  };

  // Handle feature click
  const handleClick = useCallback(
    (info: PickingInfo) => {
      if (info.object && onFeatureClick) {
        onFeatureClick(info.object as GeoJSONFeature);
      }
    },
    [onFeatureClick]
  );

  // Create Deck.gl layers
  const layers = [
    new GeoJsonLayer({
      id: 'geojson-layer',
      data: filteredData,

      // Styling
      filled: true,
      stroked: true,
      pointType: 'circle',

      // Dynamic styling based on feature properties
      getFillColor: (f) => getFeatureColor(f as GeoJSONFeature),
      getLineColor: (f) => getFeatureColor(f as GeoJSONFeature),
      getPointRadius: (f) => getPointRadius(f as GeoJSONFeature),
      getLineWidth: (f) => getLineWidth(f as GeoJSONFeature),

      // Interaction
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 100],

      // Click handler
      onClick: handleClick,

      // Hover handler
      onHover: (info) => setHoverInfo(info),

      // Performance
      updateTriggers: {
        getFillColor: [filteredData],
        getLineColor: [filteredData],
        getPointRadius: [filteredData],
      },
    }),
  ];

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState }) => setViewState(viewState as ViewState)}
        controller={true}
        layers={layers}
        getCursor={() => (hoverInfo?.object ? 'pointer' : 'grab')}
      >
        <Map
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          attributionControl={false}
        />
      </DeckGL>

      {/* Hover tooltip */}
      {hoverInfo?.object && (
        <div
          style={{
            position: 'absolute',
            left: hoverInfo.x,
            top: hoverInfo.y,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '4px',
            pointerEvents: 'none',
            transform: 'translate(-50%, -100%)',
            marginTop: '-10px',
            fontSize: '12px',
            whiteSpace: 'nowrap',
            zIndex: 1000,
          }}
        >
          <strong>{(hoverInfo.object as GeoJSONFeature).properties.name}</strong>
          <br />
          {(hoverInfo.object as GeoJSONFeature).properties.type} •{' '}
          {(hoverInfo.object as GeoJSONFeature).properties.status}
        </div>
      )}

      {/* Feature count badge */}
      <div
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '6px 12px',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: 'bold',
        }}
      >
        {filteredData.features.length} assets
      </div>
    </div>
  );
}
