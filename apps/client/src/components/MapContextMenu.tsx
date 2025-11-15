import { Menu, MenuItem, MenuDivider } from '@blueprintjs/core';
import { IconNames } from '@blueprintjs/icons';

interface MapContextMenuProps {
  x: number;
  y: number;
  longitude: number;
  latitude: number;
  onCreatePoint: (lng: number, lat: number) => void;
  onCreateZone: (lng: number, lat: number) => void;
  onPrecisionInput: (lng: number, lat: number) => void;
  onClose: () => void;
}

/**
 * Context menu for map right-click actions
 */
export function MapContextMenu({
  x,
  y,
  longitude,
  latitude,
  onCreatePoint,
  onCreateZone,
  onPrecisionInput,
  onClose,
}: MapContextMenuProps) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        zIndex: 1000,
        backgroundColor: '#1E1E1E',
        borderRadius: '4px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
        minWidth: '200px',
      }}
      onMouseLeave={onClose}
    >
      <Menu>
        <MenuItem
          icon={IconNames.MAP_MARKER}
          text="Create Point Here"
          onClick={() => {
            onCreatePoint(longitude, latitude);
            onClose();
          }}
        />
        <MenuItem
          icon={IconNames.POLYGON_FILTER}
          text="Create Zone"
          onClick={() => {
            onCreateZone(longitude, latitude);
            onClose();
          }}
        />
        <MenuDivider />
        <MenuItem
          icon={IconNames.NUMERICAL}
          text="Precision Input..."
          onClick={() => {
            onPrecisionInput(longitude, latitude);
            onClose();
          }}
        />
        <MenuDivider />
        <MenuItem
          icon={IconNames.GEOLOCATION}
          text={`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`}
          disabled
          labelElement={
            <span style={{ fontSize: '11px', color: '#888' }}>Coordinates</span>
          }
        />
      </Menu>
    </div>
  );
}
