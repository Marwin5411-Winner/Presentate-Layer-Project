import { useState, useCallback, useRef, useEffect } from 'react';
import Map from 'react-map-gl/mapbox';
import { DeckGL } from '@deck.gl/react';
import type { PickingInfo } from '@deck.gl/core';
import { GeoJsonLayer } from '@deck.gl/layers';
import type { GeoJSONFeatureCollection, GeoJSONFeature, ViewState, AssetType, AssetStatus } from '../types';
import { PrecisionInputModal } from './PrecisionInputModal';
import { EditFeaturePanel } from './EditFeaturePanel';
import { MapContextMenu } from './MapContextMenu';
import { createAsset, updateAsset, deleteAsset } from '../utils/api';
import { OverlayToaster, Intent, Button } from '@blueprintjs/core';
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
    initialGeometry?: GeoJSON.Geometry;
  }>({
    isOpen: false,
    longitude: 0,
    latitude: 0,
    mode: 'point',
  });
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    longitude: number;
    latitude: number;
  }>({
    isOpen: false,
    x: 0,
    y: 0,
    longitude: 0,
    latitude: 0,
  });
  const [drawingMode, setDrawingMode] = useState<boolean>(false);
  const [drawingPoints, setDrawingPoints] = useState<number[][]>([]);
  const deckRef = useRef<any>(null);
  // Long press timer ref
  const longPressTimer = useRef<Timer | null>(null);

  // Filter data based on visible layers
  const filteredData: GeoJSONFeatureCollection = {
    type: 'FeatureCollection',
    features: visibleLayers
      ? data.features.filter((f) => visibleLayers.has(f.properties.type))
      : data.features,
  };

  // Handle touch events for long press (iPad/Tablet support)
  const handleTouchStart = useCallback((info: PickingInfo) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }

    // Start a timer for long press (500ms)
    longPressTimer.current = setTimeout(() => {
      if (info.coordinate) {
        setContextMenu({
          isOpen: true,
          x: info.x,
          y: info.y,
          longitude: info.coordinate[0],
          latitude: info.coordinate[1],
        });
      }
    }, 500);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchMove = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Handle feature click for feature selection
  const handleClick = useCallback(
    (info: PickingInfo) => {
      // If context menu is open, close it
      if (contextMenu.isOpen) {
        setContextMenu((prev) => ({ ...prev, isOpen: false }));
        return true;
      }

      // If in drawing mode, add point
      if (drawingMode && info.coordinate) {
        setDrawingPoints((prev) => [...prev, info.coordinate as number[]]);
        return true;
      }

      // Feature selection
      if (info.object && onFeatureClick) {
        onFeatureClick(info.object as GeoJSONFeature);
        return true;
      }

      return false;
    },
    [onFeatureClick, contextMenu.isOpen, drawingMode]
  );

  const finishDrawing = () => {
    if (drawingPoints.length < 3) {
      // Need at least 3 points for a polygon
       getToaster().then(toaster => toaster.show({
        message: 'Need at least 3 points for a zone',
        intent: Intent.WARNING,
      }));
      return;
    }

    // Close the ring
    const points = [...drawingPoints];
    if (points[0][0] !== points[points.length - 1][0] || points[0][1] !== points[points.length - 1][1]) {
      points.push(points[0]);
    }

    const geometry: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [points],
    };

    setPrecisionInputModal({
      isOpen: true,
      longitude: points[0][0],
      latitude: points[0][1],
      mode: 'polygon',
      initialGeometry: geometry
    });

    setDrawingMode(false);
    setDrawingPoints([]);
  };

  const cancelDrawing = () => {
    setDrawingMode(false);
    setDrawingPoints([]);
  };

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
          if (drawingMode) {
             cancelDrawing();
          } else {
             setPrecisionInputModal((prev) => ({ ...prev, isOpen: false }));
             if (editFeature && onEditComplete) {
               onEditComplete();
             }
          }
          break;
        case 'i':
          if (!drawingMode) {
            setPrecisionInputModal({
              isOpen: true,
              longitude: viewState.longitude,
              latitude: viewState.latitude,
              mode: 'point',
            });
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewState, editFeature, onEditComplete, drawingMode]);

  // Create Deck.gl layers
  const layers: any[] = [
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

  // Add drawing layer if active
  if (drawingMode && drawingPoints.length > 0) {
    const drawingLayer = new GeoJsonLayer({
      id: 'drawing-layer',
      data: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'LineString', // Use LineString while drawing, visualize as Polygon if closed? Or just lines
              coordinates: drawingPoints,
            },
            properties: {},
          },
          // Add points for vertices
          ...drawingPoints.map((pt, i) => ({
             type: 'Feature',
             geometry: { type: 'Point', coordinates: pt },
             properties: { index: i }
          }))
        ],
      },
      filled: false,
      stroked: true,
      getLineColor: [255, 255, 0, 255],
      getLineWidth: 2,
      getPointRadius: 5,
      getFillColor: [255, 255, 0, 100],
    });
    layers.push(drawingLayer);
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}
         onContextMenu={(e) => e.preventDefault()}
    >
      <DeckGL
        ref={deckRef}
        viewState={viewState}
        onViewStateChange={({ viewState }) => setViewState(viewState as ViewState)}
        onContextMenu={(e: any) => {
             e.preventDefault();
             if (deckRef.current && deckRef.current.deck) {
                 // Calculate position relative to the canvas/viewport
                 const deck = deckRef.current.deck;
                 const canvas = deck.canvas;
                 if (canvas) {
                     const rect = canvas.getBoundingClientRect();
                     const x = e.clientX - rect.left;
                     const y = e.clientY - rect.top;

                     // Get viewport
                     const viewport = deck.viewManager.getViewports()[0];
                     if (viewport) {
                         const coords = viewport.unproject([x, y]);
                         if (coords) {
                             setContextMenu({
                                 isOpen: true,
                                 x: e.clientX,
                                 y: e.clientY,
                                 longitude: coords[0],
                                 latitude: coords[1],
                             });
                         }
                     }
                 }
             }
        }}
        controller={{
           doubleClickZoom: !drawingMode, // Disable double click zoom when drawing
        }}
        layers={layers}
        getCursor={() => {
          if (drawingMode) return 'crosshair';
          return hoverInfo?.object ? 'pointer' : 'grab';
        }}
        onClick={handleClick} // Use onClick instead of passing it to GeoJsonLayer if we want to capture map clicks
        onDragStart={handleTouchStart} // For touch devices
        onDragEnd={handleTouchEnd}
        onTouchStart={handleTouchStart} // DeckGL forwards these?
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
      >
        <Map
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          attributionControl={false}
          reuseMaps
        />
      </DeckGL>


      {contextMenu.isOpen && (
        <MapContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          longitude={contextMenu.longitude}
          latitude={contextMenu.latitude}
          onCreatePoint={(lng, lat) => {
            setPrecisionInputModal({
              isOpen: true,
              longitude: lng,
              latitude: lat,
              mode: 'point',
            });
          }}
          onCreateZone={(lng, lat) => {
             // Start drawing mode
             setDrawingMode(true);
             setDrawingPoints([[lng, lat]]);
             getToaster().then(t => t.show({
                message: 'Click to add points. Click "Finish" when done.',
                intent: Intent.PRIMARY,
                icon: 'edit'
             }));
          }}
          onPrecisionInput={(lng, lat) => {
            setPrecisionInputModal({
              isOpen: true,
              longitude: lng,
              latitude: lat,
              mode: 'point',
            });
          }}
          onCopyLocation={(lng, lat) => {
             const text = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
             navigator.clipboard.writeText(text).then(() => {
                getToaster().then(t => t.show({
                   message: 'Coordinates copied to clipboard',
                   intent: Intent.SUCCESS,
                   icon: 'clipboard'
                }));
             });
          }}
          onClose={() => setContextMenu(prev => ({ ...prev, isOpen: false }))}
        />
      )}

      {/* Drawing Toolbar / Finish Button */}
      {drawingMode && (
         <div
            style={{
                position: 'absolute',
                top: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 1100,
                display: 'flex',
                gap: '10px',
                backgroundColor: 'rgba(0,0,0,0.8)',
                padding: '10px',
                borderRadius: '8px'
            }}
         >
             <span style={{ color: 'white', alignSelf: 'center', fontWeight: 'bold' }}>
                 Drawing Zone ({drawingPoints.length} points)
             </span>
             <Button intent={Intent.SUCCESS} onClick={finishDrawing} icon="tick">Finish</Button>
             <Button intent={Intent.DANGER} onClick={cancelDrawing} icon="cross">Cancel</Button>
         </div>
      )}

      {/* Precision Input Toolbar Button - Only show if not drawing */}
      {!drawingMode && (
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
      )}

      {/* Precision Input Modal */}
      <PrecisionInputModal
        key={`${precisionInputModal.isOpen}-${precisionInputModal.mode}-${precisionInputModal.longitude}-${precisionInputModal.latitude}`}
        isOpen={precisionInputModal.isOpen}
        onClose={() => setPrecisionInputModal((prev) => ({ ...prev, isOpen: false }))}
        onSave={handlePrecisionCreate}
        initialLongitude={precisionInputModal.longitude}
        initialLatitude={precisionInputModal.latitude}
        mode={precisionInputModal.mode}
        initialGeometry={precisionInputModal.initialGeometry}
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
