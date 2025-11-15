import type { GeoJSONFeatureCollection, GeoJSONFeature, AssetType, AssetStatus } from '../types';

/**
 * API base URL - empty string because Vite proxy handles routing
 */
const API_BASE = '';

/**
 * Fetch all assets as GeoJSON
 */
export async function fetchAssets(params?: {
  type?: AssetType;
  status?: AssetStatus;
  bbox?: string;
}): Promise<GeoJSONFeatureCollection> {
  const queryParams = new URLSearchParams();

  if (params?.type) queryParams.append('type', params.type);
  if (params?.status) queryParams.append('status', params.status);
  if (params?.bbox) queryParams.append('bbox', params.bbox);

  const url = `${API_BASE}/api/assets${queryParams.toString() ? `?${queryParams}` : ''}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch assets: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch a specific layer's assets
 */
export async function fetchLayer(layerType: string): Promise<GeoJSONFeatureCollection> {
  const response = await fetch(`${API_BASE}/api/layers/${layerType}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch layer: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch a single asset by ID
 */
export async function fetchAsset(id: string) {
  const response = await fetch(`${API_BASE}/api/assets/${id}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch asset: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Create a new asset
 */
export async function createAsset(data: {
  name: string;
  type: AssetType;
  status: AssetStatus;
  geometry: GeoJSON.Geometry;
  properties?: Record<string, any>;
}): Promise<GeoJSONFeature> {
  const response = await fetch(`${API_BASE}/api/assets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create asset: ${error}`);
  }

  return response.json();
}

/**
 * Update an existing asset
 */
export async function updateAsset(
  id: string,
  data: {
    name: string;
    type: AssetType;
    status: AssetStatus;
    geometry: GeoJSON.Geometry;
    properties?: Record<string, any>;
  }
): Promise<GeoJSONFeature> {
  const response = await fetch(`${API_BASE}/api/assets/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update asset: ${error}`);
  }

  return response.json();
}

/**
 * Delete an asset
 */
export async function deleteAsset(id: string): Promise<{ success: boolean; id: string }> {
  const response = await fetch(`${API_BASE}/api/assets/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to delete asset: ${error}`);
  }

  return response.json();
}

/**
 * Update only the geometry of an asset
 */
export async function updateAssetGeometry(
  id: string,
  geometry: GeoJSON.Geometry
): Promise<GeoJSONFeature> {
  const response = await fetch(`${API_BASE}/api/assets/${id}/geometry`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ geometry }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update asset geometry: ${error}`);
  }

  return response.json();
}
