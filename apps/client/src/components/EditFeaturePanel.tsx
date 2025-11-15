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
  Alert,
} from '@blueprintjs/core';
import { IconNames } from '@blueprintjs/icons';
import type { AssetType, AssetStatus, GeoJSONFeature } from '../types';

interface EditFeaturePanelProps {
  feature: GeoJSONFeature | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    id: string,
    data: {
      name: string;
      type: AssetType;
      status: AssetStatus;
      geometry: GeoJSON.Geometry;
      properties?: Record<string, any>;
    }
  ) => void;
  onDelete: (id: string) => void;
}

/**
 * Panel for editing existing geospatial features
 */
export function EditFeaturePanel({
  feature,
  isOpen,
  onClose,
  onSave,
  onDelete,
}: EditFeaturePanelProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<AssetType>('poi');
  const [status, setStatus] = useState<AssetStatus>('active');
  const [customProperties, setCustomProperties] = useState('{}');
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (feature) {
      setName(feature.properties.name || '');
      setType(feature.properties.type || 'poi');
      setStatus(feature.properties.status || 'active');

      // Extract custom properties (excluding standard ones)
      const { id, name: _name, type: _type, status: _status, createdAt, updatedAt, ...custom } =
        feature.properties;
      setCustomProperties(JSON.stringify(custom, null, 2));
    }
  }, [feature]);

  const handleSave = () => {
    if (!feature) return;

    try {
      setError('');

      // Validate name
      if (!name.trim()) {
        setError('Name is required');
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

      onSave(feature.id, {
        name: name.trim(),
        type,
        status,
        geometry: feature.geometry as any,
        properties,
      });

      onClose();
    } catch (e) {
      setError('An error occurred while saving');
      console.error(e);
    }
  };

  const handleDelete = () => {
    if (!feature) return;
    onDelete(feature.id);
    setShowDeleteConfirm(false);
    onClose();
  };

  if (!feature) {
    return null;
  }

  return (
    <>
      <Dialog
        isOpen={isOpen}
        onClose={onClose}
        title="Edit Feature"
        icon={IconNames.EDIT}
        style={{ width: '500px', paddingBottom: 0 }}
      >
        <div className="bp5-dialog-body">
          {error && (
            <Callout intent={Intent.DANGER} style={{ marginBottom: '12px' }}>
              {error}
            </Callout>
          )}

          <FormGroup label="Name" labelFor="edit-name-input" labelInfo="(required)">
            <InputGroup
              id="edit-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </FormGroup>

          <FormGroup label="Type" labelFor="edit-type-select">
            <HTMLSelect
              id="edit-type-select"
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

          <FormGroup label="Status" labelFor="edit-status-select">
            <HTMLSelect
              id="edit-status-select"
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

          <FormGroup
            label="Geometry Type"
            labelFor="edit-geometry-type"
            helperText="Geometry type cannot be changed"
          >
            <InputGroup id="edit-geometry-type" value={feature.geometry.type} disabled />
          </FormGroup>

          <FormGroup
            label="Custom Properties (JSON)"
            labelFor="edit-props-input"
            helperText="Optional additional properties"
          >
            <TextArea
              id="edit-props-input"
              value={customProperties}
              onChange={(e) => setCustomProperties(e.target.value)}
              fill
              style={{ fontFamily: 'monospace', fontSize: '12px', minHeight: '100px' }}
            />
          </FormGroup>
        </div>

        <div className="bp5-dialog-footer">
          <div className="bp5-dialog-footer-actions">
            <Button
              intent={Intent.DANGER}
              icon={IconNames.TRASH}
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete
            </Button>
            <div style={{ flex: 1 }} />
            <Button onClick={onClose}>Cancel</Button>
            <Button intent={Intent.PRIMARY} onClick={handleSave} icon={IconNames.TICK}>
              Save Changes
            </Button>
          </div>
        </div>
      </Dialog>

      <Alert
        isOpen={showDeleteConfirm}
        cancelButtonText="Cancel"
        confirmButtonText="Delete"
        intent={Intent.DANGER}
        icon={IconNames.TRASH}
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
      >
        <p>
          Are you sure you want to delete <strong>{feature.properties.name}</strong>?
        </p>
        <p>This action cannot be undone.</p>
      </Alert>
    </>
  );
}
