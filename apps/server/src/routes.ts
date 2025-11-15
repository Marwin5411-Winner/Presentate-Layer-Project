import { Elysia, t } from 'elysia';
import { sql } from './db';
import type { AssetQueryParams, GeoJSONFeatureCollection } from './types';

/**
 * API Routes for the geospatial dashboard
 */
export const routes = new Elysia({ prefix: '/api' })
  /**
   * GET /api/assets
   * Returns all assets as a GeoJSON FeatureCollection
   *
   * Query params:
   * - type: Filter by asset type (vehicle, incident, poi, zone, route)
   * - status: Filter by status (active, inactive, warning, critical)
   * - bbox: Bounding box filter "minLon,minLat,maxLon,maxLat"
   */
  .get(
    '/assets',
    async ({ query }) => {
      try {
        const { type, status, bbox } = query as AssetQueryParams;

        // Build dynamic query based on filters
        let sqlQuery;

        if (!type && !status && !bbox) {
          // No filters - use the optimized view
          sqlQuery = sql`SELECT geojson FROM assets_geojson`;
        } else {
          // Build filtered query
          let conditions = [sql`deleted_at IS NULL`];

          if (type) {
            conditions.push(sql`type = ${type}`);
          }

          if (status) {
            conditions.push(sql`status = ${status}`);
          }

          if (bbox) {
            const [minLon, minLat, maxLon, maxLat] = bbox.split(',').map(Number);
            if (minLon && minLat && maxLon && maxLat) {
              conditions.push(sql`
                ST_Within(
                  geometry,
                  ST_MakeEnvelope(${minLon}, ${minLat}, ${maxLon}, ${maxLat}, 4326)
                )
              `);
            }
          }

          // Combine conditions with AND
          const whereClause = conditions.reduce((acc, condition, i) => {
            if (i === 0) return condition;
            return sql`${acc} AND ${condition}`;
          });

          // Build the GeoJSON query
          sqlQuery = sql`
            SELECT
              jsonb_build_object(
                'type', 'FeatureCollection',
                'features', COALESCE(jsonb_agg(
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
                ), '[]'::jsonb)
              ) as geojson
            FROM assets
            WHERE ${whereClause}
          `;
        }

        const result = await sqlQuery;

        // Extract the GeoJSON from the result
        const geojson: GeoJSONFeatureCollection =
          result[0]?.geojson || { type: 'FeatureCollection', features: [] };

        return geojson;
      } catch (error) {
        console.error('Error fetching assets:', error);
        throw new Error('Failed to fetch assets');
      }
    },
    {
      query: t.Object({
        type: t.Optional(t.String()),
        status: t.Optional(t.String()),
        bbox: t.Optional(t.String()),
      }),
    }
  )

  /**
   * GET /api/assets/:id
   * Get a single asset by ID
   */
  .get('/assets/:id', async ({ params: { id } }) => {
    try {
      const result = await sql`
        SELECT
          id,
          name,
          type,
          status,
          ST_AsGeoJSON(geometry)::jsonb as geometry,
          properties,
          created_at,
          updated_at
        FROM assets
        WHERE id = ${id} AND deleted_at IS NULL
      `;

      if (result.length === 0) {
        throw new Error('Asset not found');
      }

      return result[0];
    } catch (error) {
      console.error('Error fetching asset:', error);
      throw new Error('Asset not found');
    }
  })

  /**
   * GET /api/layers/:layerType
   * Get assets for a specific layer (vehicles, incidents, etc.)
   */
  .get('/layers/:layerType', async ({ params: { layerType } }) => {
    try {
      // Map layer type to view name
      const viewMap: Record<string, string> = {
        vehicles: 'vehicles_geojson',
        incidents: 'incidents_geojson',
      };

      const viewName = viewMap[layerType];

      if (!viewName) {
        // Fallback to filtering by type
        const result = await sql`
          SELECT
            jsonb_build_object(
              'type', 'FeatureCollection',
              'features', COALESCE(jsonb_agg(
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
              ), '[]'::jsonb)
            ) as geojson
          FROM assets
          WHERE type = ${layerType} AND deleted_at IS NULL
        `;

        return result[0]?.geojson || { type: 'FeatureCollection', features: [] };
      }

      // Use the optimized view
      const result = await sql`SELECT geojson FROM ${sql(viewName)}`;

      return result[0]?.geojson || { type: 'FeatureCollection', features: [] };
    } catch (error) {
      console.error('Error fetching layer:', error);
      throw new Error('Failed to fetch layer');
    }
  })

  /**
   * GET /api/health
   * Health check endpoint
   */
  .get('/health', () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'geospatial-dashboard-api',
  }));
