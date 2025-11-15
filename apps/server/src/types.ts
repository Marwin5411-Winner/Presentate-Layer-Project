/**
 * Asset types matching the database enum
 */
export type AssetType = 'vehicle' | 'incident' | 'poi' | 'zone' | 'route';

/**
 * Asset status matching the database enum
 */
export type AssetStatus = 'active' | 'inactive' | 'warning' | 'critical';

/**
 * Base Asset model (matches database table)
 */
export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  status: AssetStatus;
  geometry: any; // PostGIS geometry (will be converted to GeoJSON)
  properties: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * GeoJSON Feature structure
 */
export interface GeoJSONFeature {
  type: 'Feature';
  id: string;
  geometry: {
    type: 'Point' | 'LineString' | 'Polygon' | 'MultiPoint' | 'MultiLineString' | 'MultiPolygon';
    coordinates: number[] | number[][] | number[][][];
  };
  properties: {
    id: string;
    name: string;
    type: AssetType;
    status: AssetStatus;
    createdAt: string;
    updatedAt: string;
    [key: string]: any; // Additional custom properties
  };
}

/**
 * GeoJSON FeatureCollection structure
 */
export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

/**
 * WebSocket message types
 */
export type WSMessageType = 'asset_update' | 'asset_create' | 'asset_delete' | 'ping' | 'pong';

/**
 * WebSocket message structure
 */
export interface WSMessage {
  type: WSMessageType;
  data?: any;
  timestamp: string;
}

/**
 * API query parameters for filtering assets
 */
export interface AssetQueryParams {
  type?: AssetType;
  status?: AssetStatus;
  bbox?: string; // Bounding box: "minLon,minLat,maxLon,maxLat"
  limit?: number;
  offset?: number;
}
