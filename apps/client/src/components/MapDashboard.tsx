import { useEffect, useRef, useState } from 'react';
import Map from '@arcgis/core/Map';
import MapView from '@arcgis/core/views/MapView';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Graphic from '@arcgis/core/Graphic';
import SketchViewModel from '@arcgis/core/widgets/Sketch/SketchViewModel';
import Point from '@arcgis/core/geometry/Point';
import Polygon from '@arcgis/core/geometry/Polygon';
import Polyline from '@arcgis/core/geometry/Polyline';
import { OverlayToaster, Intent } from '@blueprintjs/core';
import '@arcgis/core/assets/esri/themes/dark/main.css';

import type { GeoJSONFeatureCollection, GeoJSONFeature, AssetType, AssetStatus } from '../types';
import { MapContextMenu } from './MapContextMenu';
import { PrecisionInputModal } from './PrecisionInputModal';
import { EditFeaturePanel } from './EditFeaturePanel';
import { createAsset, updateAsset, deleteAsset } from '../utils/api';

interface MapDashboardProps {
  data: GeoJSONFeatureCollection;
  onFeatureClick?: (feature: GeoJSONFeature) => void;
  visibleLayers?: Set<string>;
  editFeature?: GeoJSONFeature | null;
  onEditComplete?: () => void;
}

// Create a toaster instance
let toasterInstance: any = null;
const getToaster = async () => {
  if (!toasterInstance) {
    toasterInstance = await OverlayToaster.create({ position: 'top' });
  }
  return toasterInstance;
};

// Helper to convert GeoJSON feature to ArcGIS Graphic
const geoJSONToGraphic = (feature: GeoJSONFeature): Graphic | null => {
  const { geometry, properties } = feature;

  let symbol;
  const color = getFeatureColor(properties.type, properties.status);

  if (geometry.type === 'Point') {
    symbol = {
      type: "simple-marker",
      color: color,
      size: getPointRadius(properties.type, properties.status),
      outline: { color: [255, 255, 255, 0.5], width: 1 }
    };
    return new Graphic({
      geometry: new Point({
        longitude: geometry.coordinates[0],
        latitude: geometry.coordinates[1]
      }),
      symbol: symbol,
      attributes: properties
    });
  } else if (geometry.type === 'Polygon') {
    symbol = {
      type: "simple-fill",
      color: [...color.slice(0, 3), 0.4], // Transparent fill
      outline: { color: color, width: 2 }
    };
    return new Graphic({
      geometry: new Polygon({
        rings: geometry.coordinates
      }),
      symbol: symbol,
      attributes: properties
    });
  } else if (geometry.type === 'LineString') {
    symbol = {
      type: "simple-line",
      color: color,
      width: 3
    };
    return new Graphic({
      geometry: new Polyline({
        paths: [geometry.coordinates]
      }),
      symbol: symbol,
      attributes: properties
    });
  }

  return null;
};

const getFeatureColor = (type: string, status: string): number[] => {
  if (status === 'critical') return [220, 38, 38]; // Red
  if (status === 'warning') return [234, 179, 8]; // Yellow

  switch (type) {
    case 'vehicle': return [59, 130, 246]; // Blue
    case 'incident': return [239, 68, 68]; // Red
    case 'poi': return [34, 197, 94]; // Green
    case 'zone': return [168, 85, 247]; // Purple
    case 'route': return [249, 115, 22]; // Orange
    default: return [156, 163, 175]; // Gray
  }
};

const getPointRadius = (type: string, status: string): number => {
  if (status === 'critical') return 12;
  if (status === 'warning') return 10;
  return type === 'vehicle' ? 8 : type === 'incident' ? 10 : 6;
};



//Get Menu



export function MapDashboard({ data, onFeatureClick, visibleLayers, editFeature, onEditComplete }: MapDashboardProps) {
  const mapDiv = useRef<HTMLDivElement>(null);
  const viewRef = useRef<MapView | null>(null);
  const graphicsLayerRef = useRef<GraphicsLayer | null>(null);
  const sketchLayerRef = useRef<GraphicsLayer | null>(null);
  const sketchVMRef = useRef<SketchViewModel | null>(null);
  const onFeatureClickRef = useRef(onFeatureClick);

  useEffect(() => {
    onFeatureClickRef.current = onFeatureClick;
  }, [onFeatureClick]);

  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    longitude: number;
    latitude: number;
  }>({ isOpen: false, x: 0, y: 0, longitude: 0, latitude: 0 });

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

  // Initialize Map
  useEffect(() => {
    if (!mapDiv.current) return;

    const map = new Map({
      basemap: "dark-gray-vector"
    });

    const graphicsLayer = new GraphicsLayer();
    const sketchLayer = new GraphicsLayer();
    map.addMany([graphicsLayer, sketchLayer]);

    graphicsLayerRef.current = graphicsLayer;
    sketchLayerRef.current = sketchLayer;

    const view = new MapView({
      container: mapDiv.current,
      map: map,
      center: [-122.4194, 37.7749],
      zoom: 12
    });

    viewRef.current = view;

    // Initialize SketchViewModel
    const sketchVM = new SketchViewModel({
      view: view,
      layer: sketchLayer,
      polygonSymbol: {
        type: "simple-fill",
        color: [150, 150, 150, 0.2],
        outline: { color: [255, 255, 255], width: 2 }
      },
      pointSymbol: {
        type: "simple-marker",
        style: "circle",
        size: 10,
        color: [255, 255, 255]
      }
    });

    sketchVM.on("create", (event) => {
      if (event.state === "complete") {
        // Open modal with geometry
        const graphic = event.graphic;
        let geoJsonGeom: GeoJSON.Geometry;

        if (graphic.geometry.type === "polygon") {
          const poly = graphic.geometry as Polygon;
          geoJsonGeom = {
            type: "Polygon",
            coordinates: poly.rings
          };

          // Get centroid for modal position? Or just center of extent
          const center = poly.extent.center;
          setPrecisionInputModal({
            isOpen: true,
            longitude: center.longitude,
            latitude: center.latitude,
            mode: 'polygon',
            initialGeometry: geoJsonGeom
          });
        } else if (graphic.geometry.type === "point") {
           const pt = graphic.geometry as Point;
           geoJsonGeom = {
             type: "Point",
             coordinates: [pt.longitude, pt.latitude]
           };
           setPrecisionInputModal({
            isOpen: true,
            longitude: pt.longitude,
            latitude: pt.latitude,
            mode: 'point',
            initialGeometry: geoJsonGeom
          });
        }

        // Clear sketch after a short delay or keep it?
        // We usually want to clear it because the modal will create a NEW asset which comes back via props.
        sketchLayer.remove(graphic);
      }
    });

    sketchVMRef.current = sketchVM;

    // Event handlers
    view.on("hold", (event) => {
      // Long press context menu
      const point = view.toMap(event.mapPoint);
      // Use native event for screen coordinates if available, otherwise fallback to x/y relative to view
      // For hold, event.x/y are view coords. If view is offset, we might need correction.
      // But hold event doesn't always give native event easily?
      // Actually, let's rely on x/y and ensure MapContextMenu uses absolute relative to container?
      // No, I switched MapContextMenu to fixed.
      // I need clientX/Y.
      // event.native does not exist on "hold" event in some versions?
      // Let's check properties.

      // For simplicity, if the map fills the rest of the screen, x/y + offset might work.
      // But let's try to use event.x + mapDiv.current.getBoundingClientRect().left?
      const rect = mapDiv.current?.getBoundingClientRect();
      const screenX = rect ? event.x + rect.left : event.x;
      const screenY = rect ? event.y + rect.top : event.y;

      setContextMenu({
        isOpen: true,
        x: screenX,
        y: screenY,
        longitude: point.longitude,
        latitude: point.latitude
      });
    });

    view.on("click", (event) => {
      // Close context menu if open
      setContextMenu(prev => {
        if (prev.isOpen) return { ...prev, isOpen: false };
        return prev;
      });

      // Check for feature click
      view.hitTest(event).then((response) => {
        const graphicHit = response.results.find(
          (result) => result.layer === graphicsLayer
        );

        if (graphicHit && graphicHit.type === "graphic") {
          const graphic = graphicHit.graphic;
          if (onFeatureClickRef.current && graphic.attributes) {
            // Reconstruct GeoJSON feature
            const feature: GeoJSONFeature = {
                type: 'Feature',
                geometry: {
                    type: graphic.geometry.type === 'point' ? 'Point' : 'Polygon', // Simplified
                    coordinates: []
                } as any,
                properties: graphic.attributes as any
            };
            onFeatureClickRef.current(feature);
          }
        }
      });
    });

    // Right click handler
    view.on("pointer-down", (event) => {
       if (event.button === 2) { // Right click
           event.stopPropagation();
           const mapPoint = view.toMap({ x: event.x, y: event.y });

           const rect = mapDiv.current?.getBoundingClientRect();
           const screenX = rect ? event.x + rect.left : event.x;
           const screenY = rect ? event.y + rect.top : event.y;

           setContextMenu({
               isOpen: true,
               x: screenX,
               y: screenY,
               longitude: mapPoint.longitude,
               latitude: mapPoint.latitude
           });
       }
    });

    return () => {
      if (view) {
        view.destroy();
      }
    };
  }, []); // Run once

  // Update Data
  useEffect(() => {
    if (!graphicsLayerRef.current) return;

    const layer = graphicsLayerRef.current;
    layer.removeAll();

    // Filter data
    const features = visibleLayers
      ? data.features.filter((f) => visibleLayers.has(f.properties.type))
      : data.features;

    const graphics = features
      .map(geoJSONToGraphic)
      .filter((g): g is Graphic => g !== null);

    layer.addMany(graphics);
  }, [data, visibleLayers]);

  // Create Asset
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

  // Actions
  const handleCreatePoint = (lng: number, lat: number) => {
      setPrecisionInputModal({
          isOpen: true,
          longitude: lng,
          latitude: lat,
          mode: 'point'
      });
  };

  const handleCreateZone = () => {
      // Start drawing polygon
      if (sketchVMRef.current) {
          sketchVMRef.current.create("polygon");
          (getToaster()).then(t => t.show({
              message: "Click on map to draw polygon. Double-click to finish.",
              intent: Intent.PRIMARY
          }));
      }
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }} onContextMenu={(e) => e.preventDefault()}>
      <div ref={mapDiv} style={{ width: '100%', height: '100%' }} />

      {contextMenu.isOpen && (
        <MapContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          longitude={contextMenu.longitude}
          latitude={contextMenu.latitude}
          onCreatePoint={handleCreatePoint}
          onCreateZone={handleCreateZone}
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
             navigator.clipboard.writeText(text).then(async () => {
                (await getToaster()).show({
                   message: 'Coordinates copied to clipboard',
                   intent: Intent.SUCCESS,
                   icon: 'clipboard'
                });
             });
          }}
          onClose={() => setContextMenu(prev => ({ ...prev, isOpen: false }))}
        />
      )}

      <PrecisionInputModal
        key={`${precisionInputModal.isOpen}-${precisionInputModal.mode}`}
        isOpen={precisionInputModal.isOpen}
        onClose={() => setPrecisionInputModal(prev => ({ ...prev, isOpen: false }))}
        onSave={handlePrecisionCreate}
        initialLongitude={precisionInputModal.longitude}
        initialLatitude={precisionInputModal.latitude}
        mode={precisionInputModal.mode}
        initialGeometry={precisionInputModal.initialGeometry}
      />

      <EditFeaturePanel
        feature={editFeature || null}
        isOpen={!!editFeature}
        onClose={() => { if (onEditComplete) onEditComplete(); }}
        onSave={async (id, data) => {
            await updateAsset(id, data);
            (await getToaster()).show({ message: "Updated", intent: Intent.SUCCESS });
        }}
        onDelete={async (id) => {
            await deleteAsset(id);
            (await getToaster()).show({ message: "Deleted", intent: Intent.SUCCESS });
        }}
      />

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
        {data.features.length} assets
      </div>
    </div>
  );
}
