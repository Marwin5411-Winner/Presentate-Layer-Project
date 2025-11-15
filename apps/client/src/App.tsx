import { useState, useMemo } from 'react';
import {
  Navbar,
  Button,
  Alignment,
  Icon,
  Tag,
  Spinner,
  Callout,
} from '@blueprintjs/core';
import { MapDashboard } from './components/MapDashboard';
import { AssetDrawer } from './components/AssetDrawer';
import { LayerToggle } from './components/LayerToggle';
import { useAssets } from './hooks/useAssets';
import type { GeoJSONFeature, LayerConfig } from './types';

// Import Blueprint.js styles
import '@blueprintjs/core/lib/css/blueprint.css';
import '@blueprintjs/icons/lib/css/blueprint-icons.css';

function App() {
  const { data, loading, error, refresh } = useAssets();
  const [selectedAsset, setSelectedAsset] = useState<GeoJSONFeature | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Layer configuration
  const [layers, setLayers] = useState<LayerConfig[]>([
    { id: 'vehicle', name: 'Vehicles', type: 'vehicle', visible: true, color: '#3b82f6' },
    { id: 'incident', name: 'Incidents', type: 'incident', visible: true, color: '#ef4444' },
    { id: 'poi', name: 'Points of Interest', type: 'poi', visible: true, color: '#22c55e' },
    { id: 'zone', name: 'Zones', type: 'zone', visible: true, color: '#a855f7' },
    { id: 'route', name: 'Routes', type: 'route', visible: true, color: '#f97316' },
  ]);

  // Get visible layer types
  const visibleLayers = useMemo(() => {
    return new Set(layers.filter((l) => l.visible).map((l) => l.type));
  }, [layers]);

  // Handle layer toggle
  const handleLayerToggle = (layerId: string) => {
    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
      )
    );
  };

  // Handle feature click
  const handleFeatureClick = (feature: GeoJSONFeature) => {
    setSelectedAsset(feature);
    setIsDrawerOpen(true);
  };

  // Close drawer
  const handleDrawerClose = () => {
    setIsDrawerOpen(false);
  };

  return (
    <div className="bp5-dark" style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Navbar */}
      <Navbar style={{ backgroundColor: '#10161a' }}>
        <Navbar.Group align={Alignment.LEFT}>
          <Navbar.Heading>
            <Icon icon="map" size={20} style={{ marginRight: '8px' }} />
            <strong>Geospatial Dashboard</strong>
          </Navbar.Heading>
          <Navbar.Divider />
          <Tag minimal intent="none">
            Real-time
          </Tag>
        </Navbar.Group>
        <Navbar.Group align={Alignment.RIGHT}>
          {loading && <Spinner size={20} />}
          <Button
            icon="refresh"
            minimal
            onClick={refresh}
            disabled={loading}
            text="Refresh"
          />
        </Navbar.Group>
      </Navbar>

      {/* Main content */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {error && (
          <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 2000, width: '400px' }}>
            <Callout intent="danger" title="Error loading data">
              {error.message}
            </Callout>
          </div>
        )}

        {!loading && data.features.length === 0 && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 2000 }}>
            <Callout intent="warning" title="No data">
              No assets found. Please check your database connection and ensure the seed data is loaded.
            </Callout>
          </div>
        )}

        <MapDashboard
          data={data}
          onFeatureClick={handleFeatureClick}
          visibleLayers={visibleLayers}
        />

        {/* Layer toggle */}
        <LayerToggle layers={layers} onLayerToggle={handleLayerToggle} />
      </div>

      {/* Asset details drawer */}
      <AssetDrawer
        isOpen={isDrawerOpen}
        onClose={handleDrawerClose}
        asset={selectedAsset}
      />
    </div>
  );
}

export default App;
