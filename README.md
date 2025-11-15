# Geospatial Dashboard

A high-performance, real-time geospatial data dashboard inspired by "Common Operating Picture" platforms like Palantir. Built with modern web technologies for visualizing and interacting with large-scale geospatial datasets.

## Features

- **Real-time Visualization**: Interactive map displaying thousands of geospatial assets (points, lines, polygons)
- **Live Updates**: WebSocket-powered real-time data synchronization
- **Click-to-Details**: Interactive asset selection with detailed information panels
- **Layer Management**: Toggle visibility of different data layers (vehicles, incidents, POIs, zones, routes)
- **High Performance**: Database-side GeoJSON generation and GPU-accelerated rendering with Deck.gl
- **Responsive UI**: Desktop-optimized interface built with Blueprint.js

## Technology Stack

### Frontend
- **React** - UI framework
- **Blueprint.js** - Desktop-class UI components
- **Mapbox GL JS** - Base map rendering
- **Deck.gl** - High-performance WebGL data visualization
- **Vite** - Build tool and dev server
- **TypeScript** - Type safety

### Backend
- **ElysiaJS** - Fast, ergonomic web framework for Bun
- **PostgreSQL + PostGIS** - Geospatial database
- **postgres.js** - PostgreSQL client
- **Native WebSockets** - Real-time data streaming

### Infrastructure
- **Bun** - JavaScript runtime and package manager
- **Bun Workspaces** - Monorepo management

## Project Structure

```
.
├── apps/
│   ├── client/          # React frontend
│   │   ├── src/
│   │   │   ├── components/  # React components
│   │   │   ├── hooks/       # Custom React hooks
│   │   │   ├── types/       # TypeScript types
│   │   │   └── utils/       # Utility functions
│   │   └── package.json
│   └── server/          # Elysia backend
│       ├── src/
│       │   ├── index.ts     # Development server
│       │   ├── production.ts # Production server (optional)
│       │   ├── routes.ts    # API routes
│       │   ├── websocket.ts # WebSocket handling
│       │   ├── db.ts        # Database connection
│       │   └── types.ts     # TypeScript types
│       ├── db/
│       │   ├── schema.sql   # Database schema
│       │   └── seeds/       # Sample data
│       └── package.json
└── package.json         # Root package.json
```

## Prerequisites

- **Bun** >= 1.0 ([Install](https://bun.sh))
- **PostgreSQL** >= 14 with PostGIS extension
- **Mapbox Account** (for map tiles) - [Sign up](https://account.mapbox.com/)

## Quick Start

### 1. Install Dependencies

```bash
bun install
```

### 2. Set Up Database

```bash
# Create database and run migrations
bun run db:init

# Or manually:
createdb geospatial_dashboard
bun run db:setup
bun run db:seed
```

### 3. Configure Environment Variables

**Server** (`apps/server/.env`):
```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/geospatial_dashboard
NODE_ENV=development
```

**Client** (`apps/client/.env`):
```env
VITE_MAPBOX_TOKEN=your_mapbox_token_here
```

Get your Mapbox token from: https://account.mapbox.com/access-tokens/

### 4. Start Development Server

```bash
bun run dev
```

This starts both the backend (port 3000) and frontend (port 5173) concurrently.

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000/api
- **WebSocket**: ws://localhost:3000/ws

## Database Schema

The database uses a single flexible `assets` table that supports multiple geometry types:

- **Points**: Vehicles, incidents, points of interest
- **LineStrings**: Routes, paths
- **Polygons**: Zones, areas

Key features:
- PostGIS `GEOMETRY` column for spatial data
- JSONB `properties` column for flexible metadata
- Spatial indexes for high-performance queries
- Database views for optimized GeoJSON generation

See `apps/server/db/README.md` for detailed schema documentation.

## API Endpoints

### GET `/api/assets`
Get all assets as GeoJSON FeatureCollection

**Query Parameters:**
- `type`: Filter by asset type (vehicle, incident, poi, zone, route)
- `status`: Filter by status (active, inactive, warning, critical)
- `bbox`: Bounding box filter `minLon,minLat,maxLon,maxLat`

### GET `/api/assets/:id`
Get a single asset by ID

### GET `/api/layers/:layerType`
Get assets for a specific layer

### GET `/api/health`
Health check endpoint

### WebSocket `/ws`
Real-time updates for asset changes

## Development

### Run Backend Only
```bash
bun run dev:server
```

### Run Frontend Only
```bash
bun run dev:client
```

### Database Management
```bash
# Reset database
bun run db:setup

# Reseed data
bun run db:seed
```

## Production Build

### Build Frontend
```bash
bun run build
```

This builds the React app to `apps/client/dist`.

### Start Server
```bash
bun run start
```

The Elysia server will serve both the API and the built frontend.

## Architecture Highlights

### Database-Side GeoJSON Generation
Instead of processing data in the backend, we leverage PostgreSQL's `ST_AsGeoJSON` and `jsonb_build_object` functions to generate complete GeoJSON FeatureCollections directly in the database. This minimizes backend processing and data transfer.

### Real-Time Updates
The WebSocket server polls the database for changes (assets updated in the last 5 seconds) and broadcasts updates to all connected clients. For production, consider implementing PostgreSQL LISTEN/NOTIFY for event-driven updates.

### Event-Driven Click Flow
```
User clicks map feature
  → Deck.gl onClick handler
  → App component state update
  → Blueprint Drawer opens
  → Asset details displayed
```

### Layer Filtering
Layers are filtered client-side using React state. The map re-renders only when layer visibility changes, with Deck.gl's `updateTriggers` ensuring efficient GPU updates.

## Performance Considerations

- **Database Indexes**: Spatial (GIST) and B-tree indexes for fast queries
- **Connection Pooling**: postgres.js manages connection pool (max 10)
- **GPU Rendering**: Deck.gl uses WebGL for rendering thousands of features
- **Optimized Views**: Pre-built database views for common queries
- **Efficient Updates**: Only changed features are re-rendered

## Customization

### Adding New Asset Types
1. Update the `asset_type` enum in `apps/server/db/schema.sql`
2. Add the type to `AssetType` in both server and client `types.ts` files
3. Update color mapping in `MapDashboard.tsx`
4. Add layer config in `App.tsx`

### Changing Map Style
Edit the `mapStyle` prop in `MapDashboard.tsx`:
```tsx
<Map mapStyle="mapbox://styles/mapbox/streets-v12" />
```

Available styles: `dark-v11`, `light-v11`, `streets-v12`, `outdoors-v12`, `satellite-v9`

## Troubleshooting

### Database Connection Fails
- Ensure PostgreSQL is running: `pg_ctl status`
- Check `DATABASE_URL` in `apps/server/.env`
- Verify PostGIS extension is installed: `psql -d geospatial_dashboard -c "CREATE EXTENSION IF NOT EXISTS postgis;"`

### Map Not Displaying
- Check that `VITE_MAPBOX_TOKEN` is set in `apps/client/.env`
- Verify the token is valid at https://account.mapbox.com/
- Check browser console for Mapbox errors

### WebSocket Connection Fails
- Ensure the backend server is running on port 3000
- Check browser console for WebSocket connection errors
- Verify Vite proxy configuration in `apps/client/vite.config.ts`

### No Assets Showing
- Verify database has data: `psql -d geospatial_dashboard -c "SELECT COUNT(*) FROM assets;"`
- Run seed script: `bun run db:seed`
- Check browser console for API errors

## Contributing

This project follows a monorepo structure with workspaces. When adding dependencies:

```bash
# Add to root
bun add -D <package>

# Add to client
bun --cwd apps/client add <package>

# Add to server
bun --cwd apps/server add <package>
```

## License

MIT
