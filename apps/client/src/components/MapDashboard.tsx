import { useState, useCallback, useRef, useEffect } from 'react';
import Map from 'react-map-gl/mapbox';
import { DeckGL } from '@deck.gl/react';
import { GeoJsonLayer } from '@deck.gl/layers';
import type { PickingInfo } from '@deck.gl/core';
import type { GeoJSONFeatureCollection, GeoJSONFeature, ViewState, AssetType, AssetStatus } from '../types';
import { DrawingToolbar, type DrawingMode } from './DrawingToolbar';
import { MapContextMenu } from './MapContextMenu';
import { PrecisionInputModal } from './PrecisionInputModal';
import { EditFeaturePanel } from './EditFeaturePanel';
import { createAsset, updateAsset, deleteAsset } from '../utils/api';
import { OverlayToaster, Intent } from '@blueprintjs/core';
import 'mapbox-gl/dist/mapbox-gl.css';

interface MapDashboardProps {
  data: GeoJSONFeatureCollection;
  onFeatureClick?: (feature: GeoJSONFeature) => void;
  visibleLayers?: Set<string>;
  editFeature?: GeoJSONFeature | null;
  onEditComplete?: () => void;
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

// Create a toaster instance
const toaster = OverlayToaster.create({ position: 'top' });

export function MapDashboard({ data, onFeatureClick, visibleLayers, editFeature, onEditComplete }: MapDashboardProps) {
  const [viewState, setViewState] = useState<ViewState>(INITIAL_VIEW_STATE);
  const [hoverInfo, setHoverInfo] = useState<PickingInfo | null>(null);
  const [drawingMode, setDrawingMode] = useState<DrawingMode>('select');
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    longitude: number;
    latitude: number;
  } | null>(null);
  const [precisionInputModal, setPrecisionInputModal] = useState<{
    isOpen: boolean;
    longitude: number;
    latitude: number;
    mode: 'point' | 'polygon' | 'rectangle' | 'circle' | 'line';
  }>({
    isOpen: false,
    longitude: 0,
    latitude: 0,
    mode: 'point',
  });
  const deckRef = useRef<any>(null);

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
      // Close context menu if open
      setContextMenu(null);

      if (drawingMode === 'delete' && info.object) {
        // Delete mode - delete the clicked feature
        const feature = info.object as GeoJSONFeature;
        handleDeleteFeature(feature.id);
        return;
      }

      if (info.object && onFeatureClick) {
        onFeatureClick(info.object as GeoJSONFeature);
      }
    },
    [onFeatureClick, drawingMode]
  );

  // Handle right-click on map
  const handleContextMenu = useCallback(
    (event: any) => {
      event.preventDefault();

      // Get the coordinates from the event
      const { lngLat } = event;
      if (!lngLat) return;

      setContextMenu({
        x: event.center.x,
        y: event.center.y,
        longitude: lngLat.lng,
        latitude: lngLat.lat,
      });
    },
    []
  );

  // Create a new feature from precision input
  const handlePrecisionCreate = async (data: {
    name: string;
    type: AssetType;
    status: AssetStatus;
    geometry: GeoJSON.Geometry;
    properties?: Record<string, any>;
  }) => {
    try {
      await createAsset(data);
      toaster.show({
        message: `Created ${data.name}`,
        intent: Intent.SUCCESS,
        icon: 'tick',
      });
    } catch (error) {
      console.error('Error creating asset:', error);
      toaster.show({
        message: 'Failed to create feature',
        intent: Intent.DANGER,
        icon: 'error',
      });
    }
  };

  // Quick create point from context menu
  const handleQuickCreatePoint = async (lng: number, lat: number) => {
    try {
      await createAsset({
        name: `Point at ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        type: 'poi',
        status: 'active',
        geometry: {
          type: 'Point',
          coordinates: [lng, lat],
        },
      });
      toaster.show({
        message: 'Point created',
        intent: Intent.SUCCESS,
        icon: 'map-marker',
      });
    } catch (error) {
      console.error('Error creating point:', error);
      toaster.show({
        message: 'Failed to create point',
        intent: Intent.DANGER,
        icon: 'error',
      });
    }
  };

  // Update an existing feature
  const handleUpdateFeature = async (
    id: string,
    data: {
      name: string;
      type: AssetType;
      status: AssetStatus;
      geometry: GeoJSON.Geometry;
      properties?: Record<string, any>;
    }
  ) => {
    try {
      await updateAsset(id, data);
      toaster.show({
        message: 'Feature updated',
        intent: Intent.SUCCESS,
        icon: 'tick',
      });
    } catch (error) {
      console.error('Error updating asset:', error);
      toaster.show({
        message: 'Failed to update feature',
        intent: Intent.DANGER,
        icon: 'error',
      });
    }
  };

  // Delete a feature
  const handleDeleteFeature = async (id: string) => {
    try {
      await deleteAsset(id);
      toaster.show({
        message: 'Feature deleted',
        intent: Intent.SUCCESS,
        icon: 'trash',
      });
    } catch (error) {
      console.error('Error deleting asset:', error);
      toaster.show({
        message: 'Failed to delete feature',
        intent: Intent.DANGER,
        icon: 'error',
      });
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'escape':
          setDrawingMode('select');
          setContextMenu(null);
          setPrecisionInputModal((prev) => ({ ...prev, isOpen: false }));
          if (editFeature && onEditComplete) {
            onEditComplete();
          }
          break;
        case 'p':
          setDrawingMode('point');
          break;
        case 'r':
          setDrawingMode('rectangle');
          break;
        case 'c':
          setDrawingMode('circle');
          break;
        case 'g':
          setDrawingMode('polygon');
          break;
        case 'l':
          setDrawingMode('line');
          break;
        case 'delete':
        case 'backspace':
          if (drawingMode !== 'delete') {
            setDrawingMode('delete');
          }
          break;
        case 'i':
          setPrecisionInputModal({
            isOpen: true,
            longitude: viewState.longitude,
            latitude: viewState.latitude,
            mode: 'point',
          });
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drawingMode, viewState]);

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
        ref={deckRef}
        viewState={viewState}
        onViewStateChange={({ viewState }) => setViewState(viewState as ViewState)}
        controller={true}
        layers={layers}
        getCursor={() => {
          if (drawingMode === 'delete') return 'not-allowed';
          if (drawingMode !== 'select') return 'crosshair';
          return hoverInfo?.object ? 'pointer' : 'grab';
        }}
      >
        <Map
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          attributionControl={false}
          onContextMenu={handleContextMenu}
        />
      </DeckGL>

      {/* Drawing Toolbar */}
      <DrawingToolbar
        activeMode={drawingMode}
        onModeChange={setDrawingMode}
        onPrecisionInput={() =>
          setPrecisionInputModal({
            isOpen: true,
            longitude: viewState.longitude,
            latitude: viewState.latitude,
            mode: 'point',
          })
        }
      />

      {/* Context Menu */}
      {contextMenu && (
        <MapContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          longitude={contextMenu.longitude}
          latitude={contextMenu.latitude}
          onCreatePoint={handleQuickCreatePoint}
          onCreateZone={(lng, lat) => {
            setDrawingMode('polygon');
            setContextMenu(null);
          }}
          onPrecisionInput={(lng, lat) => {
            setPrecisionInputModal({
              isOpen: true,
              longitude: lng,
              latitude: lat,
              mode: 'point',
            });
          }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Precision Input Modal */}
      <PrecisionInputModal
        isOpen={precisionInputModal.isOpen}
        onClose={() => setPrecisionInputModal((prev) => ({ ...prev, isOpen: false }))}
        onSave={handlePrecisionCreate}
        initialLongitude={precisionInputModal.longitude}
        initialLatitude={precisionInputModal.latitude}
        mode={precisionInputModal.mode}
      />

      {/* Edit Feature Panel */}
      <EditFeaturePanel
        feature={editFeature || null}
        isOpen={!!editFeature}
        onClose={() => {
          if (onEditComplete) onEditComplete();
        }}
        onSave={handleUpdateFeature}
        onDelete={handleDeleteFeature}
      />

      {/* Hover tooltip */}
      {hoverInfo?.object && drawingMode === 'select' && (
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

      {/* Drawing mode indicator */}
      {drawingMode !== 'select' && (
        <div
          style={{
            position: 'absolute',
            top: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '4px',
            fontSize: '13px',
            fontWeight: 'bold',
            zIndex: 100,
            border: '1px solid rgba(255, 255, 255, 0.2)',
          }}
        >
          {drawingMode.charAt(0).toUpperCase() + drawingMode.slice(1)} Mode
          <span style={{ opacity: 0.7, marginLeft: '8px', fontSize: '11px' }}>
            (Press ESC to exit)
          </span>
        </div>
      )}
    </div>
  );
}
