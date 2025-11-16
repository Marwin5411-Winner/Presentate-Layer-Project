-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Asset Types Enum (optional, but helps maintain data integrity)
CREATE TYPE asset_type AS ENUM ('vehicle', 'incident', 'poi', 'zone', 'route');

-- Asset Status Enum
CREATE TYPE asset_status AS ENUM ('active', 'inactive', 'warning', 'critical');

-- Main Assets Table
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Asset identification
    name VARCHAR(255) NOT NULL,
    type asset_type NOT NULL,
    status asset_status DEFAULT 'active',

    -- Geospatial data (supports points, lines, polygons)
    geometry GEOMETRY(Geometry, 4326) NOT NULL,

    -- Additional metadata (flexible JSON for custom properties)
    properties JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Soft delete support
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create spatial index for high-performance queries
CREATE INDEX IF NOT EXISTS idx_assets_geometry
    ON assets USING GIST(geometry);

-- Create index on type for filtering
CREATE INDEX IF NOT EXISTS idx_assets_type
    ON assets(type) WHERE deleted_at IS NULL;

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_assets_status
    ON assets(status) WHERE deleted_at IS NULL;

-- Create index on updated_at for real-time updates
CREATE INDEX IF NOT EXISTS idx_assets_updated_at
    ON assets(updated_at DESC);

-- Create GIN index on properties for JSON queries
CREATE INDEX IF NOT EXISTS idx_assets_properties
    ON assets USING GIN(properties);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
CREATE TRIGGER update_assets_updated_at
    BEFORE UPDATE ON assets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- View for active assets as GeoJSON FeatureCollection
-- This is the core query that will be used by the API
CREATE OR REPLACE VIEW assets_geojson AS
SELECT
    jsonb_build_object(
        'type', 'FeatureCollection',
        'features', jsonb_agg(
            jsonb_build_object(
                'type', 'Feature',
                'id', id,
                'geometry', ST_AsGeoJSON(geometry)::jsonb,
                'properties', jsonb_build_object(
                    'id', id,
                    'name', name,
                    'type', type,
                    'status', status,
                    'created_at', created_at,
                    'updated_at', updated_at
                ) || COALESCE(properties, '{}'::jsonb)
            )
        )
    ) as geojson
FROM assets
WHERE deleted_at IS NULL;

-- Layer-specific views for performance
CREATE OR REPLACE VIEW vehicles_geojson AS
SELECT
    jsonb_build_object(
        'type', 'FeatureCollection',
        'features', jsonb_agg(
            jsonb_build_object(
                'type', 'Feature',
                'id', id,
                'geometry', ST_AsGeoJSON(geometry)::jsonb,
                'properties', jsonb_build_object(
                    'id', id,
                    'name', name,
                    'type', type,
                    'status', status,
                    'created_at', created_at,
                    'updated_at', updated_at
                ) || COALESCE(properties, '{}'::jsonb)
            )
        )
    ) as geojson
FROM assets
WHERE type = 'vehicle' AND deleted_at IS NULL;

CREATE OR REPLACE VIEW incidents_geojson AS
SELECT
    jsonb_build_object(
        'type', 'FeatureCollection',
        'features', jsonb_agg(
            jsonb_build_object(
                'type', 'Feature',
                'id', id,
                'geometry', ST_AsGeoJSON(geometry)::jsonb,
                'properties', jsonb_build_object(
                    'id', id,
                    'name', name,
                    'type', type,
                    'status', status,
                    'created_at', created_at,
                    'updated_at', updated_at
                ) || COALESCE(properties, '{}'::jsonb)
            )
        )
    ) as geojson
FROM assets
WHERE type = 'incident' AND deleted_at IS NULL;

-- Push notification subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    endpoint TEXT UNIQUE NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    expiration_time BIGINT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_push_subscriptions_updated_at
    BEFORE UPDATE ON push_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
