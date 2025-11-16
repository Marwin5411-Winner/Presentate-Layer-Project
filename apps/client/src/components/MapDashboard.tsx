import { useState, useCallback, useRef, useEffect } from 'react';
import Map from 'react-map-gl/mapbox';
import { DeckGL } from '@deck.gl/react';
import type { PickingInfo } from '@deck.gl/core';
import { GeoJsonLayer } from '@deck.gl/layers';
import { _ContextMenuWidget as ContextMenuWidget } from '@deck.gl/widgets';
import type { GeoJSONFeatureCollection, GeoJSONFeature, ViewState, AssetType, AssetStatus } from '../types';
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

// Create a toaster instance (initialized on first use)
let toasterInstance: any = null;
const getToaster = async () => {
  if (!toasterInstance) {
    toasterInstance = await OverlayToaster.create({ position: 'top' });
  }
  return toasterInstance;
};

export function MapDashboard({ data, onFeatureClick, visibleLayers, editFeature, onEditComplete }: MapDashboardProps) {
  const [viewState, setViewState] = useState<ViewState>(INITIAL_VIEW_STATE);
  const [hoverInfo, setHoverInfo] = useState<PickingInfo | null>(null);
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

  // Handle feature click for feature selection
  const handleClick = useCallback(
    (info: PickingInfo) => {
      // Feature selection
      if (info.object && onFeatureClick) {
        onFeatureClick(info.object as GeoJSONFeature);
        return true;
      }

      return false;
    },
    [onFeatureClick]
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
      (await getToaster()).show({
        message: `Created ${data.name}`,
        intent: Intent.SUCCESS,
        icon: 'tick',
      });
    } catch (error) {
      console.error('Error creating asset:', error);
      (await getToaster()).show({
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
      (await getToaster()).show({
        message: 'Point created',
        intent: Intent.SUCCESS,
        icon: 'map-marker',
      });
    } catch (error) {
      console.error('Error creating point:', error);
      (await getToaster()).show({
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
      (await getToaster()).show({
        message: 'Feature updated',
        intent: Intent.SUCCESS,
        icon: 'tick',
      });
    } catch (error) {
      console.error('Error updating asset:', error);
      (await getToaster()).show({
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
      (await getToaster()).show({
        message: 'Feature deleted',
        intent: Intent.SUCCESS,
        icon: 'trash',
      });
    } catch (error) {
      console.error('Error deleting asset:', error);
      (await getToaster()).show({
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
          setPrecisionInputModal((prev) => ({ ...prev, isOpen: false }));
          if (editFeature && onEditComplete) {
            onEditComplete();
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
  }, [viewState, editFeature, onEditComplete]);

  // Create Deck.gl layers
  const layers = [
    new GeoJsonLayer({
      id: 'geojson-layer',
      data: filteredData as any,

      // Styling
      filled: true,
      stroked: true,

      // Dynamic styling based on feature properties
      getFillColor: (f: any) => getFeatureColor(f as GeoJSONFeature),
      getLineColor: (f: any) => getFeatureColor(f as GeoJSONFeature),
      getLineWidth: (f: any) => getLineWidth(f as GeoJSONFeature),
      getPointRadius: (f: any) => getPointRadius(f as GeoJSONFeature),

      // Interaction
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 100],

      // Click handler for feature selection
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

  // Create ContextMenuWidget
  const contextMenuWidget = new ContextMenuWidget({
    position: { x: 0, y: 0 },
    menuItems: [],
    visible: false,
    getMenuItems: (info: PickingInfo) => {
      if (info.object) {
        // Context menu for existing feature
        const feature = info.object as GeoJSONFeature;
        return [
          { key: 'name', label: feature.properties.name },
          { key: 'edit', label: 'Edit Properties' },
          { key: 'delete', label: 'Delete' },
        ];
      }

      // Context menu for empty map area
      if (info.coordinate) {
        return [
          { key: 'add-point', label: 'Create Point Here' },
          { key: 'add-zone', label: 'Create Zone (Polygon)' },
          { key: 'add-circle', label: 'Create Circle' },
          { key: 'add-route', label: 'Create Route (Line)' },
          { key: 'divider-1', label: '---' },
          { key: 'precision-input', label: 'Precision Input...' },
          { key: 'divider-2', label: '---' },
          { key: 'center-map', label: 'Center Map Here' },
        ];
      }

      return [];
    },
    onMenuItemSelected: async (key: string, pickInfo: PickingInfo | null) => {
      if (!pickInfo) return;

      const feature = pickInfo.object as GeoJSONFeature;
      const coordinate = pickInfo.coordinate;

      switch (key) {
        case 'edit':
          if (feature && onFeatureClick) {
            onFeatureClick(feature);
          }
          break;

        case 'delete':
          if (feature?.id) {
            await handleDeleteFeature(feature.id);
          }
          break;

        case 'add-point':
          if (coordinate) {
            await handleQuickCreatePoint(coordinate[0], coordinate[1]);
          }
          break;

        case 'add-zone':
        case 'add-circle':
        case 'add-route':
          if (coordinate) {
            let mode: 'point' | 'polygon' | 'rectangle' | 'circle' | 'line' = 'polygon';
            if (key === 'add-circle') mode = 'circle';
            if (key === 'add-route') mode = 'line';

            setPrecisionInputModal({
              isOpen: true,
              longitude: coordinate[0],
              latitude: coordinate[1],
              mode,
            });
          }
          break;

        case 'precision-input':
          if (coordinate) {
            setPrecisionInputModal({
              isOpen: true,
              longitude: coordinate[0],
              latitude: coordinate[1],
              mode: 'point',
            });
          }
          break;

        case 'center-map':
          if (coordinate && deckRef.current) {
            setViewState({
              ...viewState,
              longitude: coordinate[0],
              latitude: coordinate[1],
              zoom: Math.max(viewState.zoom, 14),
            });
          }
          break;
      }
    },
  });

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <DeckGL
        ref={deckRef}
        viewState={viewState}
        onViewStateChange={({ viewState }) => setViewState(viewState as ViewState)}
        controller={true}
        layers={layers}
        widgets={[contextMenuWidget]}
        getCursor={() => {
          return hoverInfo?.object ? 'pointer' : 'grab';
        }}
      >
        <Map
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          attributionControl={false}
          reuseMaps
        />
      </DeckGL>

      {/* Precision Input Toolbar Button */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: '20px',
          transform: 'translateX(-50%)',
          zIndex: 1100,
        }}
      >
        <button
          onClick={() =>
            setPrecisionInputModal({
              isOpen: true,
              longitude: viewState.longitude,
              latitude: viewState.latitude,
              mode: 'point',
            })
          }
          style={{
            backgroundColor: 'rgba(30, 30, 30, 0.95)',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '4px',
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 'bold',
          }}
        >
          Precision Input (I)
        </button>
      </div>

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
