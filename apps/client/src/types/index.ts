/**
 * Client-side types for the geospatial dashboard
 */

export type AssetType = 'vehicle' | 'incident' | 'poi' | 'zone' | 'route';
export type AssetStatus = 'active' | 'inactive' | 'warning' | 'critical';

export interface GeoJSONGeometry {
  type: 'Point' | 'LineString' | 'Polygon' | 'MultiPoint' | 'MultiLineString' | 'MultiPolygon';
  coordinates: number[] | number[][] | number[][][];
}

export interface AssetProperties {
  id: string;
  name: string;
  type: AssetType;
  status: AssetStatus;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

export interface GeoJSONFeature {
  type: 'Feature';
  id: string;
  geometry: GeoJSONGeometry;
  properties: AssetProperties;
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

export interface WSMessage {
  type: 'asset_update' | 'asset_create' | 'asset_delete' | 'ping' | 'pong';
  data?: any;
  timestamp: string;
}

export interface LayerConfig {
  id: string;
  name: string;
  type: AssetType;
  visible: boolean;
  color: string;
}

export interface ViewState {
  latitude: number;
  longitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
}
