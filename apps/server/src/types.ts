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
export type WSMessageType =
  | 'asset_update'
  | 'asset_create'
  | 'asset_delete'
  | 'notification'
  | 'ping'
  | 'pong'
  | 'connected';

/**
 * WebSocket message structure
 */
export interface WSMessage {
  type: WSMessageType;
  data?: any;
  timestamp: string;
}

/**
 * Notification payload broadcasted to clients and push subscribers
 */
export type NotificationSeverity = 'info' | 'success' | 'warning' | 'critical';

export interface NotificationPayload {
  id: string;
  source: 'api' | 'websocket' | 'kafka' | 'system';
  type: string;
  severity: NotificationSeverity;
  title: string;
  message: string;
  data?: Record<string, any>;
  createdAt: string;
}

/**
 * Push subscription payload from client
 */
export interface PushSubscriptionRequest {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushSubscriptionRecord extends PushSubscriptionRequest {
  id: string;
  userAgent?: string | null;
  createdAt: string;
  updatedAt: string;
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
