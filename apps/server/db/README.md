# Database Setup

This directory contains the PostgreSQL database schema with PostGIS extension for the geospatial dashboard.

## Prerequisites

- PostgreSQL 14+ installed
- PostGIS extension available

## Setup Instructions

### 1. Create Database

```bash
# Create the database
createdb geospatial_dashboard

# Or using psql
psql -U postgres -c "CREATE DATABASE geospatial_dashboard;"
```

### 2. Run Schema Migration

```bash
# Apply the schema
psql -U postgres -d geospatial_dashboard -f schema.sql
```

### 3. Seed Sample Data (Optional)

```bash
# Insert sample data for development/testing
psql -U postgres -d geospatial_dashboard -f seeds/01_sample_data.sql
```

## Quick Setup Script

```bash
# All-in-one setup (creates DB, applies schema, seeds data)
createdb geospatial_dashboard
psql -U postgres -d geospatial_dashboard -f schema.sql
psql -U postgres -d geospatial_dashboard -f seeds/01_sample_data.sql
```

## Environment Variables

The server expects these environment variables:

```env
DATABASE_URL=postgres://postgres:password@localhost:5432/geospatial_dashboard
```

Create a `.env` file in `apps/server/` with your connection details.

## Schema Overview

### Tables

- **assets**: Main table storing all geospatial assets (vehicles, incidents, POIs, zones, routes)
  - Supports points, lines, and polygons via the `geometry` column
  - Flexible metadata via `properties` JSONB column
  - Soft delete support
  - Automatic timestamp management

### Views

- **assets_geojson**: Returns all assets as a GeoJSON FeatureCollection
- **vehicles_geojson**: Returns only vehicle assets as GeoJSON
- **incidents_geojson**: Returns only incident assets as GeoJSON

These views are optimized for the frontend and use database-side GeoJSON generation for maximum performance.

## Performance Features

- Spatial indexes (GIST) on geometry columns
- B-tree indexes on type, status, and updated_at
- GIN index on properties JSONB for fast JSON queries
- Database-side GeoJSON generation (no backend processing needed)

## Sample Queries

### Get all assets as GeoJSON
```sql
SELECT geojson FROM assets_geojson;
```

### Get assets by type
```sql
SELECT * FROM assets WHERE type = 'vehicle' AND deleted_at IS NULL;
```

### Find assets within a bounding box
```sql
SELECT * FROM assets
WHERE ST_Within(
    geometry,
    ST_MakeEnvelope(-122.5, 37.7, -122.3, 37.9, 4326)
);
```

### Real-time updates (get recently changed assets)
```sql
SELECT * FROM assets
WHERE updated_at > NOW() - INTERVAL '5 minutes'
ORDER BY updated_at DESC;
```
