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
      <H5>Additional Properties</H5>
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
            <span style={{ fontWeight: 'bold', textTransform: 'capitalize' }}>
              {key.replace(/_/g, ' ')}:
            </span>
            <span>{JSON.stringify(value)}</span>
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
    >
      <div className={Classes.DRAWER_BODY}>
        <div className={Classes.DIALOG_BODY}>
          {/* Asset Name */}
          <H4>{properties.name}</H4>

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
            <H5>Information</H5>
            <div style={{ marginTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span style={{ fontWeight: 'bold' }}>ID:</span>
                <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                  {properties.id.slice(0, 8)}...
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span style={{ fontWeight: 'bold' }}>Created:</span>
                <span>{formatDate(properties.createdAt)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span style={{ fontWeight: 'bold' }}>Updated:</span>
                <span>{formatDate(properties.updatedAt)}</span>
              </div>
            </div>
          </div>

          <Divider style={{ margin: '16px 0' }} />

          {/* Geometry Info */}
          <div>
            <H5>Geometry</H5>
            <div style={{ marginTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span style={{ fontWeight: 'bold' }}>Type:</span>
                <span>{geometry.type}</span>
              </div>
              {geometry.type === 'Point' && (
                <>
                  <div
                    style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}
                  >
                    <span style={{ fontWeight: 'bold' }}>Longitude:</span>
                    <span>{(geometry.coordinates as number[])[0].toFixed(6)}</span>
                  </div>
                  <div
                    style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}
                  >
                    <span style={{ fontWeight: 'bold' }}>Latitude:</span>
                    <span>{(geometry.coordinates as number[])[1].toFixed(6)}</span>
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
