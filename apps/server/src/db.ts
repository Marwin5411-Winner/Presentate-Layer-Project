import postgres from 'postgres';

/**
 * Database configuration
 * Reads from environment variables or uses defaults for development
 */
const DATABASE_URL = process.env.DATABASE_URL ||
  'postgres://postgres:postgres@localhost:5432/geospatial_dashboard';

/**
 * Create postgres connection
 *
 * Configuration optimized for:
 * - High-performance queries
 * - Connection pooling
 * - Automatic type conversion
 */
export const sql = postgres(DATABASE_URL, {
  max: 10, // Maximum number of connections in pool
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 10, // Connection timeout in seconds

  // Transform column names from snake_case to camelCase
  transform: {
    column: {
      to: postgres.toCamel,
      from: postgres.fromCamel,
    },
  },

  // Enable debug mode in development
  debug: process.env.NODE_ENV === 'development',
});

/**
 * Test database connection
 */
export async function testConnection() {
  try {
    const result = await sql`SELECT NOW() as current_time, PostGIS_Version() as postgis_version`;
    console.log('✅ Database connected successfully');
    console.log(`   Time: ${result[0].currentTime}`);
    console.log(`   PostGIS: ${result[0].postgisVersion}`);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

/**
 * Graceful shutdown
 */
export async function closeConnection() {
  await sql.end({ timeout: 5 });
  console.log('Database connection closed');
}

// Handle process termination
process.on('SIGTERM', closeConnection);
process.on('SIGINT', closeConnection);
