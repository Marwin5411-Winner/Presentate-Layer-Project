import { useState, useEffect } from 'react';
import {
  Dialog,
  FormGroup,
  InputGroup,
  Button,
  Intent,
  HTMLSelect,
  TextArea,
  Callout,
} from '@blueprintjs/core';
import { IconNames } from '@blueprintjs/icons';
import type { AssetType, AssetStatus } from '../types';

interface PrecisionInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    type: AssetType;
    status: AssetStatus;
    geometry: GeoJSON.Geometry;
    properties?: Record<string, any>;
  }) => void;
  initialLongitude?: number;
  initialLatitude?: number;
  mode: 'point' | 'polygon' | 'rectangle' | 'circle' | 'line';
}

/**
 * Modal for precision input of geospatial features
 */
export function PrecisionInputModal({
  isOpen,
  onClose,
  onSave,
  initialLongitude = 0,
  initialLatitude = 0,
  mode,
}: PrecisionInputModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<AssetType>('poi');
  const [status, setStatus] = useState<AssetStatus>('active');
  const [latitude, setLatitude] = useState(initialLatitude.toFixed(6));
  const [longitude, setLongitude] = useState(initialLongitude.toFixed(6));
  const [radius, setRadius] = useState('100');
  const [coordinates, setCoordinates] = useState('');
  const [customProperties, setCustomProperties] = useState('{}');
  const [error, setError] = useState('');

  useEffect(() => {
    setLatitude(initialLatitude.toFixed(6));
    setLongitude(initialLongitude.toFixed(6));
  }, [initialLatitude, initialLongitude]);

  const handleSave = () => {
    try {
      setError('');

      // Validate name
      if (!name.trim()) {
        setError('Name is required');
        return;
      }

      // Validate coordinates
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);

      if (isNaN(lat) || lat < -90 || lat > 90) {
        setError('Latitude must be between -90 and 90');
        return;
      }

      if (isNaN(lng) || lng < -180 || lng > 180) {
        setError('Longitude must be between -180 and 180');
        return;
      }

      // Parse custom properties
      let properties = {};
      if (customProperties.trim()) {
        try {
          properties = JSON.parse(customProperties);
        } catch (e) {
          setError('Invalid JSON in custom properties');
          return;
        }
      }

      // Build geometry based on mode
      let geometry: GeoJSON.Geometry;

      switch (mode) {
        case 'point':
          geometry = {
            type: 'Point',
            coordinates: [lng, lat],
          };
          break;

        case 'circle': {
          // Convert circle to polygon using turf
          const rad = parseFloat(radius);
          if (isNaN(rad) || rad <= 0) {
            setError('Radius must be a positive number');
            return;
          }

          // Create a simple circle approximation with 64 points
          const points: number[][] = [];
          const steps = 64;
          for (let i = 0; i < steps; i++) {
            const angle = (i * 360) / steps;
            const radian = (angle * Math.PI) / 180;
            // Simple approximation (not accounting for Earth's curvature)
            const dx = (rad / 111320) * Math.cos(radian);
            const dy = (rad / 110540) * Math.sin(radian);
            points.push([lng + dx, lat + dy]);
          }
          // Close the ring
          points.push(points[0]);

          geometry = {
            type: 'Polygon',
            coordinates: [points],
          };
          break;
        }

        case 'polygon': {
          // Parse coordinates from text area
          if (!coordinates.trim()) {
            setError('Polygon coordinates are required');
            return;
          }

          const lines = coordinates.trim().split('\n');
          const points: number[][] = [];

          for (const line of lines) {
            const [lngStr, latStr] = line.split(',').map((s) => s.trim());
            const lineLng = parseFloat(lngStr);
            const lineLat = parseFloat(latStr);

            if (isNaN(lineLng) || isNaN(lineLat)) {
              setError('Invalid coordinate format. Use: longitude, latitude');
              return;
            }

            points.push([lineLng, lineLat]);
          }

          if (points.length < 3) {
            setError('Polygon must have at least 3 points');
            return;
          }

          // Close the ring if not already closed
          const firstPoint = points[0];
          const lastPoint = points[points.length - 1];
          if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
            points.push([...firstPoint]);
          }

          geometry = {
            type: 'Polygon',
            coordinates: [points],
          };
          break;
        }

        case 'line': {
          // Parse coordinates from text area
          if (!coordinates.trim()) {
            setError('Line coordinates are required');
            return;
          }

          const lines = coordinates.trim().split('\n');
          const points: number[][] = [];

          for (const line of lines) {
            const [lngStr, latStr] = line.split(',').map((s) => s.trim());
            const lineLng = parseFloat(lngStr);
            const lineLat = parseFloat(latStr);

            if (isNaN(lineLng) || isNaN(lineLat)) {
              setError('Invalid coordinate format. Use: longitude, latitude');
              return;
            }

            points.push([lineLng, lineLat]);
          }

          if (points.length < 2) {
            setError('Line must have at least 2 points');
            return;
          }

          geometry = {
            type: 'LineString',
            coordinates: points,
          };
          break;
        }

        default:
          geometry = {
            type: 'Point',
            coordinates: [lng, lat],
          };
      }

      onSave({
        name: name.trim(),
        type,
        status,
        geometry,
        properties,
      });

      // Reset form
      setName('');
      setCustomProperties('{}');
      setCoordinates('');
      setRadius('100');
      onClose();
    } catch (e) {
      setError('An error occurred while saving');
      console.error(e);
    }
  };

  const getModeTitle = () => {
    switch (mode) {
      case 'point':
        return 'Create Point';
      case 'circle':
        return 'Create Circle Zone';
      case 'polygon':
        return 'Create Polygon';
      case 'line':
        return 'Create Line/Route';
      default:
        return 'Create Feature';
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={getModeTitle()}
      icon={IconNames.NUMERICAL}
      style={{ width: '600px', paddingBottom: 0 }}
    >
      <div className="bp5-dialog-body">
        {error && (
          <Callout intent={Intent.DANGER} style={{ marginBottom: '12px' }}>
            {error}
          </Callout>
        )}

        <FormGroup label="Name" labelFor="name-input" labelInfo="(required)">
          <InputGroup
            id="name-input"
            placeholder="Enter feature name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </FormGroup>

        <FormGroup label="Type" labelFor="type-select">
          <HTMLSelect
            id="type-select"
            value={type}
            onChange={(e) => setType(e.target.value as AssetType)}
            fill
          >
            <option value="poi">Point of Interest</option>
            <option value="zone">Zone</option>
            <option value="incident">Incident</option>
            <option value="vehicle">Vehicle</option>
            <option value="route">Route</option>
          </HTMLSelect>
        </FormGroup>

        <FormGroup label="Status" labelFor="status-select">
          <HTMLSelect
            id="status-select"
            value={status}
            onChange={(e) => setStatus(e.target.value as AssetStatus)}
            fill
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </HTMLSelect>
        </FormGroup>

        {mode === 'point' && (
          <>
            <div style={{ display: 'flex', gap: '12px' }}>
              <FormGroup label="Latitude" labelFor="lat-input" style={{ flex: 1 }}>
                <InputGroup
                  id="lat-input"
                  placeholder="-90 to 90"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                />
              </FormGroup>

              <FormGroup label="Longitude" labelFor="lng-input" style={{ flex: 1 }}>
                <InputGroup
                  id="lng-input"
                  placeholder="-180 to 180"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                />
              </FormGroup>
            </div>
          </>
        )}

        {mode === 'circle' && (
          <>
            <div style={{ display: 'flex', gap: '12px' }}>
              <FormGroup label="Center Latitude" labelFor="lat-input" style={{ flex: 1 }}>
                <InputGroup
                  id="lat-input"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                />
              </FormGroup>

              <FormGroup label="Center Longitude" labelFor="lng-input" style={{ flex: 1 }}>
                <InputGroup
                  id="lng-input"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                />
              </FormGroup>
            </div>

            <FormGroup label="Radius (meters)" labelFor="radius-input">
              <InputGroup
                id="radius-input"
                placeholder="100"
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
              />
            </FormGroup>
          </>
        )}

        {(mode === 'polygon' || mode === 'line') && (
          <FormGroup
            label="Coordinates"
            labelFor="coords-input"
            helperText="One coordinate pair per line: longitude, latitude"
          >
            <TextArea
              id="coords-input"
              placeholder={`-122.4194, 37.7749\n-122.4184, 37.7739\n-122.4174, 37.7729`}
              value={coordinates}
              onChange={(e) => setCoordinates(e.target.value)}
              fill
              style={{ minHeight: '120px', fontFamily: 'monospace', fontSize: '12px' }}
            />
          </FormGroup>
        )}

        <FormGroup
          label="Custom Properties (JSON)"
          labelFor="props-input"
          helperText="Optional additional properties"
        >
          <TextArea
            id="props-input"
            placeholder='{"key": "value"}'
            value={customProperties}
            onChange={(e) => setCustomProperties(e.target.value)}
            fill
            style={{ fontFamily: 'monospace', fontSize: '12px' }}
          />
        </FormGroup>
      </div>

      <div className="bp5-dialog-footer">
        <div className="bp5-dialog-footer-actions">
          <Button onClick={onClose}>Cancel</Button>
          <Button intent={Intent.PRIMARY} onClick={handleSave} icon={IconNames.TICK}>
            Create
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
