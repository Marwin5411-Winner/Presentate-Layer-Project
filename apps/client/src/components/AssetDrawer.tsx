import { Drawer, Classes, H4, H5, Tag, Divider } from '@blueprintjs/core';
import type { GeoJSONFeature } from '../types';

interface AssetDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  asset: GeoJSONFeature | null;
}

/**
 * Get color for status tag
 */
const getStatusIntent = (status: string) => {
  switch (status) {
    case 'critical':
      return 'danger';
    case 'warning':
      return 'warning';
    case 'active':
      return 'success';
    case 'inactive':
      return 'none';
    default:
      return 'none';
  }
};

/**
 * Get color for type tag
 */
const getTypeIntent = (type: string) => {
  switch (type) {
    case 'vehicle':
      return 'primary';
    case 'incident':
      return 'danger';
    case 'poi':
      return 'success';
    case 'zone':
      return 'none';
    case 'route':
      return 'none';
    default:
      return 'none';
  }
};

/**
 * Format date string
 */
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString();
};

/**
 * Render custom properties
 */
const renderProperties = (properties: Record<string, any>) => {
  // Exclude standard properties
  const standardKeys = ['id', 'name', 'type', 'status', 'createdAt', 'updatedAt'];
  const customProps = Object.entries(properties).filter(
    ([key]) => !standardKeys.includes(key)
  );

  if (customProps.length === 0) return null;

  return (
    <div style={{ marginTop: '16px' }}>
      <H5 style={{ color: '#ffffff' }}>Additional Properties</H5>
      <div style={{ marginTop: '8px' }}>
        {customProps.map(([key, value]) => (
          <div
            key={key}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '4px 0',
            }}
          >
            <span style={{ fontWeight: 'bold', textTransform: 'capitalize', color: '#ffffff' }}>
              {key.replace(/_/g, ' ')}:
            </span>
            <span style={{ color: '#ffffff' }}>{JSON.stringify(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export function AssetDrawer({ isOpen, onClose, asset }: AssetDrawerProps) {
  if (!asset) return null;

  const { properties, geometry } = asset;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Asset Details"
      size="400px"
      canOutsideClickClose={true}
      canEscapeKeyClose={true}
      style={{ color: '#ffffff' }}
    >
      <div className={Classes.DRAWER_BODY} style={{ color: '#ffffff' }}>
        <div className={Classes.DIALOG_BODY} style={{ color: '#ffffff' }}>
          {/* Asset Name */}
          <H4 style={{ color: '#ffffff' }}>{properties.name}</H4>

          {/* Tags */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <Tag intent={getTypeIntent(properties.type)} large>
              {properties.type}
            </Tag>
            <Tag intent={getStatusIntent(properties.status)} large>
              {properties.status}
            </Tag>
          </div>

          <Divider style={{ margin: '16px 0' }} />

          {/* Basic Info */}
          <div>
            <H5 style={{ color: '#ffffff' }}>Information</H5>
            <div style={{ marginTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span style={{ fontWeight: 'bold', color: '#ffffff' }}>ID:</span>
                <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#ffffff' }}>
                  {properties.id.slice(0, 8)}...
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span style={{ fontWeight: 'bold', color: '#ffffff' }}>Created:</span>
                <span style={{ color: '#ffffff' }}>{formatDate(properties.createdAt)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span style={{ fontWeight: 'bold', color: '#ffffff' }}>Updated:</span>
                <span style={{ color: '#ffffff' }}>{formatDate(properties.updatedAt)}</span>
              </div>
            </div>
          </div>

          <Divider style={{ margin: '16px 0' }} />

          {/* Geometry Info */}
          <div>
            <H5 style={{ color: '#ffffff' }}>Geometry</H5>
            <div style={{ marginTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span style={{ fontWeight: 'bold', color: '#ffffff' }}>Type:</span>
                <span style={{ color: '#ffffff' }}>{geometry.type}</span>
              </div>
              {geometry.type === 'Point' && (
                <>
                  <div
                    style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}
                  >
                    <span style={{ fontWeight: 'bold', color: '#ffffff' }}>Longitude:</span>
                    <span style={{ color: '#ffffff' }}>{(geometry.coordinates as number[])[0].toFixed(6)}</span>
                  </div>
                  <div
                    style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}
                  >
                    <span style={{ fontWeight: 'bold', color: '#ffffff' }}>Latitude:</span>
                    <span style={{ color: '#ffffff' }}>{(geometry.coordinates as number[])[1].toFixed(6)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Custom Properties */}
          {renderProperties(properties)}
        </div>
      </div>
    </Drawer>
  );
}
