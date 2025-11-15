import { Card, Switch, H5 } from '@blueprintjs/core';
import type { LayerConfig } from '../types';

interface LayerToggleProps {
  layers: LayerConfig[];
  onLayerToggle: (layerId: string) => void;
}

export function LayerToggle({ layers, onLayerToggle }: LayerToggleProps) {
  return (
    <Card
      style={{
        position: 'absolute',
        top: '70px',
        left: '10px',
        width: '200px',
        zIndex: 1000,
        backgroundColor: 'rgba(16, 22, 26, 0.9)',
        color: '#ffffff',
      }}
    >
      <H5 style={{ marginBottom: '12px', color: '#ffffff' }}>Layers</H5>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {layers.map((layer) => (
          <div
            key={layer.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: layer.color,
                }}
              />
              <span style={{ textTransform: 'capitalize', color: '#ffffff' }}>{layer.name}</span>
            </div>
            <Switch
              checked={layer.visible}
              onChange={() => onLayerToggle(layer.id)}
              style={{ margin: 0 }}
            />
          </div>
        ))}
      </div>
    </Card>
  );
}
