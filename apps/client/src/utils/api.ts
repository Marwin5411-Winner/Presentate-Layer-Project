import type { GeoJSONFeatureCollection, AssetType, AssetStatus } from '../types';

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
