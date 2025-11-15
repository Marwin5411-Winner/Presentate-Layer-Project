-- Sample seed data for testing the geospatial dashboard
-- This creates various types of assets across different locations

-- Clear existing data (for development only)
TRUNCATE TABLE assets RESTART IDENTITY CASCADE;

-- Insert sample vehicles (points) scattered across a city
-- Using coordinates around San Francisco as an example
INSERT INTO assets (name, type, status, geometry, properties) VALUES
    (
        'Patrol Unit Alpha',
        'vehicle',
        'active',
        ST_SetSRID(ST_MakePoint(-122.4194, 37.7749), 4326),
        '{"speed": 45, "heading": 90, "driver": "Officer Smith", "unit_id": "P-001"}'::jsonb
    ),
    (
        'Patrol Unit Bravo',
        'vehicle',
        'active',
        ST_SetSRID(ST_MakePoint(-122.4312, 37.7849), 4326),
        '{"speed": 30, "heading": 180, "driver": "Officer Jones", "unit_id": "P-002"}'::jsonb
    ),
    (
        'Ambulance 5',
        'vehicle',
        'warning',
        ST_SetSRID(ST_MakePoint(-122.4094, 37.7649), 4326),
        '{"speed": 65, "heading": 270, "driver": "Medic Johnson", "unit_id": "A-005", "sirens": true}'::jsonb
    ),
    (
        'Fire Truck 12',
        'vehicle',
        'critical',
        ST_SetSRID(ST_MakePoint(-122.4294, 37.7549), 4326),
        '{"speed": 55, "heading": 45, "crew_size": 6, "unit_id": "F-012", "sirens": true}'::jsonb
    ),
    (
        'Delivery Van 201',
        'vehicle',
        'active',
        ST_SetSRID(ST_MakePoint(-122.3994, 37.7949), 4326),
        '{"speed": 25, "heading": 135, "company": "FastShip", "unit_id": "D-201"}'::jsonb
    );

-- Insert sample incidents (points)
INSERT INTO assets (name, type, status, geometry, properties) VALUES
    (
        'Traffic Accident - Highway 101',
        'incident',
        'critical',
        ST_SetSRID(ST_MakePoint(-122.4150, 37.7700), 4326),
        '{"severity": "high", "reported_at": "2025-11-15T10:30:00Z", "responders": 3, "injuries": 2}'::jsonb
    ),
    (
        'Fire - Commercial Building',
        'incident',
        'critical',
        ST_SetSRID(ST_MakePoint(-122.4250, 37.7600), 4326),
        '{"severity": "critical", "reported_at": "2025-11-15T09:45:00Z", "building_type": "commercial", "evacuated": true}'::jsonb
    ),
    (
        'Medical Emergency',
        'incident',
        'warning',
        ST_SetSRID(ST_MakePoint(-122.4100, 37.7800), 4326),
        '{"severity": "medium", "reported_at": "2025-11-15T11:00:00Z", "patient_count": 1}'::jsonb
    ),
    (
        'Suspicious Activity',
        'incident',
        'active',
        ST_SetSRID(ST_MakePoint(-122.4000, 37.7900), 4326),
        '{"severity": "low", "reported_at": "2025-11-15T08:15:00Z", "investigating": true}'::jsonb
    );

-- Insert Points of Interest (POI)
INSERT INTO assets (name, type, status, geometry, properties) VALUES
    (
        'City Hall',
        'poi',
        'active',
        ST_SetSRID(ST_MakePoint(-122.4183, 37.7790), 4326),
        '{"category": "government", "capacity": 500, "hours": "8:00-18:00"}'::jsonb
    ),
    (
        'Central Hospital',
        'poi',
        'active',
        ST_SetSRID(ST_MakePoint(-122.4150, 37.7850), 4326),
        '{"category": "medical", "capacity": 200, "emergency": true, "beds_available": 45}'::jsonb
    ),
    (
        'Police Station - Downtown',
        'poi',
        'active',
        ST_SetSRID(ST_MakePoint(-122.4200, 37.7800), 4326),
        '{"category": "safety", "officers_on_duty": 12, "dispatch_center": true}'::jsonb
    );

-- Insert sample zones (polygons) - Patrol zones
INSERT INTO assets (name, type, status, geometry, properties) VALUES
    (
        'Patrol Zone North',
        'zone',
        'active',
        ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
            ST_MakePoint(-122.430, 37.790),
            ST_MakePoint(-122.410, 37.790),
            ST_MakePoint(-122.410, 37.810),
            ST_MakePoint(-122.430, 37.810),
            ST_MakePoint(-122.430, 37.790)
        ])), 4326),
        '{"zone_id": "Z-001", "patrol_units": 2, "priority": "high"}'::jsonb
    ),
    (
        'Patrol Zone South',
        'zone',
        'active',
        ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
            ST_MakePoint(-122.430, 37.750),
            ST_MakePoint(-122.410, 37.750),
            ST_MakePoint(-122.410, 37.770),
            ST_MakePoint(-122.430, 37.770),
            ST_MakePoint(-122.430, 37.750)
        ])), 4326),
        '{"zone_id": "Z-002", "patrol_units": 3, "priority": "medium"}'::jsonb
    ),
    (
        'Restricted Zone - Construction',
        'zone',
        'warning',
        ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
            ST_MakePoint(-122.425, 37.775),
            ST_MakePoint(-122.415, 37.775),
            ST_MakePoint(-122.415, 37.785),
            ST_MakePoint(-122.425, 37.785),
            ST_MakePoint(-122.425, 37.775)
        ])), 4326),
        '{"zone_id": "Z-003", "restriction": "no entry", "active_until": "2025-12-31"}'::jsonb
    );

-- Insert sample routes (lines) - Patrol routes
INSERT INTO assets (name, type, status, geometry, properties) VALUES
    (
        'Route A - Downtown Circuit',
        'route',
        'active',
        ST_SetSRID(ST_MakeLine(ARRAY[
            ST_MakePoint(-122.4194, 37.7749),
            ST_MakePoint(-122.4250, 37.7800),
            ST_MakePoint(-122.4200, 37.7850),
            ST_MakePoint(-122.4150, 37.7800),
            ST_MakePoint(-122.4194, 37.7749)
        ]), 4326),
        '{"route_id": "R-001", "length_km": 2.5, "avg_duration_min": 15, "patrol_frequency": "hourly"}'::jsonb
    ),
    (
        'Route B - Waterfront Patrol',
        'route',
        'active',
        ST_SetSRID(ST_MakeLine(ARRAY[
            ST_MakePoint(-122.3950, 37.8000),
            ST_MakePoint(-122.3900, 37.7950),
            ST_MakePoint(-122.3950, 37.7900),
            ST_MakePoint(-122.4000, 37.7950)
        ]), 4326),
        '{"route_id": "R-002", "length_km": 3.2, "avg_duration_min": 20, "patrol_frequency": "every 2 hours"}'::jsonb
    );

-- Log the number of inserted records
DO $$
DECLARE
    vehicle_count INT;
    incident_count INT;
    poi_count INT;
    zone_count INT;
    route_count INT;
BEGIN
    SELECT COUNT(*) INTO vehicle_count FROM assets WHERE type = 'vehicle';
    SELECT COUNT(*) INTO incident_count FROM assets WHERE type = 'incident';
    SELECT COUNT(*) INTO poi_count FROM assets WHERE type = 'poi';
    SELECT COUNT(*) INTO zone_count FROM assets WHERE type = 'zone';
    SELECT COUNT(*) INTO route_count FROM assets WHERE type = 'route';

    RAISE NOTICE 'Seed data inserted successfully:';
    RAISE NOTICE '  - Vehicles: %', vehicle_count;
    RAISE NOTICE '  - Incidents: %', incident_count;
    RAISE NOTICE '  - POIs: %', poi_count;
    RAISE NOTICE '  - Zones: %', zone_count;
    RAISE NOTICE '  - Routes: %', route_count;
    RAISE NOTICE 'Total assets: %', vehicle_count + incident_count + poi_count + zone_count + route_count;
END $$;
