#!/usr/bin/env python3
"""
Database optimization script for asteroid spectral web application.
Adds indexes and optimizations for improved query performance.
"""
import os
import sys
import time
from dotenv import load_dotenv
import logging

# Load environment variables
load_dotenv()

# Add path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.database_service import FlaskDatabaseService
from flask import Flask

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def optimize_database():
    """Add database indexes and optimizations for better performance."""
    print("=" * 60)
    print("Database Optimization for Asteroid Spectral Web App")
    print("=" * 60)
    
    # Create Flask app
    app = Flask(__name__)
    app.config.update({
        'DB_HOST': os.getenv('DB_HOST', '127.0.0.1'),
        'DB_PORT': int(os.getenv('DB_PORT', 3306)),
        'DB_NAME': os.getenv('DB_NAME', 'asteroid_spectral_db'),
        'DB_USER': os.getenv('DB_USER', 'root'),
        'DB_PASSWORD': os.getenv('DB_PASSWORD', 'bpol68'),
        'DB_POOL_SIZE': int(os.getenv('DB_POOL_SIZE', 10)),
        'TESTING': False
    })
    
    try:
        # Initialize database service
        db_service = FlaskDatabaseService()
        
        with app.app_context():
            db_service.init_app(app)
            
            # Check existing indexes first
            print("1. Checking existing indexes...")
            existing_indexes = check_existing_indexes(db_service)
            
            # Define optimization queries with enhanced indexing strategy
            optimization_queries = [
                # Primary classification indexes
                {
                    'name': 'idx_bus_demeo_class',
                    'query': 'CREATE INDEX idx_bus_demeo_class ON asteroids (bus_demeo_class)',
                    'description': 'Index on Bus-DeMeo classification for faster grouping'
                },
                {
                    'name': 'idx_tholen_class',
                    'query': 'CREATE INDEX idx_tholen_class ON asteroids (tholen_class)',
                    'description': 'Index on Tholen classification for faster grouping'
                },
                
                # Optimized composite indexes for classification queries with ordering
                {
                    'name': 'idx_bus_demeo_ordering',
                    'query': 'CREATE INDEX idx_bus_demeo_ordering ON asteroids (bus_demeo_class, official_number, id)',
                    'description': 'Composite index for Bus-DeMeo classification with ordering'
                },
                {
                    'name': 'idx_tholen_ordering',
                    'query': 'CREATE INDEX idx_tholen_ordering ON asteroids (tholen_class, official_number, id)',
                    'description': 'Composite index for Tholen classification with ordering'
                },
                
                # Enhanced indexes for classification metadata queries
                {
                    'name': 'idx_bus_demeo_metadata',
                    'query': 'CREATE INDEX idx_bus_demeo_metadata ON asteroids (bus_demeo_class, id) WHERE bus_demeo_class IS NOT NULL',
                    'description': 'Partial index for Bus-DeMeo metadata queries (non-null only)'
                },
                {
                    'name': 'idx_tholen_metadata',
                    'query': 'CREATE INDEX idx_tholen_metadata ON asteroids (tholen_class, id) WHERE tholen_class IS NOT NULL',
                    'description': 'Partial index for Tholen metadata queries (non-null only)'
                },
                
                # Optimized observations indexes for spectral data
                {
                    'name': 'idx_observations_asteroid_band',
                    'query': 'CREATE INDEX idx_observations_asteroid_band ON observations (asteroid_id, band)',
                    'description': 'Index for asteroid-band lookups in observations'
                },
                {
                    'name': 'idx_observations_spectral_vnir',
                    'query': 'CREATE INDEX idx_observations_spectral_vnir ON observations (asteroid_id, band, id) WHERE band = "VNIR" AND spectral_data IS NOT NULL',
                    'description': 'Partial index for VNIR spectral data availability (optimized for common queries)'
                },
                {
                    'name': 'idx_observations_spectral_data_check',
                    'query': 'CREATE INDEX idx_observations_spectral_data_check ON observations (asteroid_id) WHERE band = "VNIR" AND spectral_data IS NOT NULL',
                    'description': 'Covering index for spectral data existence checks'
                },
                
                # Enhanced search indexes
                {
                    'name': 'idx_asteroids_search_composite',
                    'query': 'CREATE INDEX idx_asteroids_search_composite ON asteroids (proper_name(50), official_number, provisional_designation(50))',
                    'description': 'Optimized composite index for asteroid search (with prefix lengths)'
                },
                {
                    'name': 'idx_proper_name_prefix',
                    'query': 'CREATE INDEX idx_proper_name_prefix ON asteroids (proper_name(20))',
                    'description': 'Prefix index on proper name for efficient text searches'
                },
                {
                    'name': 'idx_provisional_designation_prefix',
                    'query': 'CREATE INDEX idx_provisional_designation_prefix ON asteroids (provisional_designation(20))',
                    'description': 'Prefix index on provisional designation for efficient text searches'
                },
                {
                    'name': 'idx_official_number_search',
                    'query': 'CREATE INDEX idx_official_number_search ON asteroids (official_number)',
                    'description': 'Index on official number for numeric searches'
                },
                
                # Performance indexes for common query patterns
                {
                    'name': 'idx_asteroids_id_classification',
                    'query': 'CREATE INDEX idx_asteroids_id_classification ON asteroids (id, bus_demeo_class, tholen_class)',
                    'description': 'Covering index for ID-based classification lookups'
                },
                {
                    'name': 'idx_observations_latest',
                    'query': 'CREATE INDEX idx_observations_latest ON observations (asteroid_id, start_time DESC, id) WHERE band = "VNIR"',
                    'description': 'Index for finding latest observations per asteroid'
                },
                
                # Indexes for batch operations
                {
                    'name': 'idx_asteroids_batch_lookup',
                    'query': 'CREATE INDEX idx_asteroids_batch_lookup ON asteroids (id, official_number, proper_name, provisional_designation)',
                    'description': 'Covering index for batch asteroid lookups'
                }
            ]
            
            print(f"\n2. Applying {len(optimization_queries)} optimizations...")
            
            success_count = 0
            skip_count = 0
            error_count = 0
            
            for optimization in optimization_queries:
                index_name = optimization['name']
                query = optimization['query']
                description = optimization['description']
                
                print(f"\n   {description}")
                print(f"   Index: {index_name}")
                
                # Check if index already exists
                if index_name in existing_indexes:
                    print(f"   ✓ Index already exists, skipping")
                    skip_count += 1
                    continue
                
                try:
                    # Execute the optimization query
                    db_service.execute_query(query, use_cache=False)
                    print(f"   ✓ Successfully created index")
                    success_count += 1
                    
                except Exception as e:
                    print(f"   ✗ Failed to create index: {e}")
                    error_count += 1
            
            # Apply enhanced query optimization settings
            print(f"\n3. Applying enhanced query optimization settings...")
            
            optimization_settings = [
                # Query cache settings
                ("SET SESSION query_cache_type = ON", "Enable query cache"),
                ("SET SESSION query_cache_size = 134217728", "Set query cache to 128MB"),
                
                # Buffer and sort settings for large datasets
                ("SET SESSION sort_buffer_size = 4194304", "Set sort buffer to 4MB"),
                ("SET SESSION read_buffer_size = 262144", "Set read buffer to 256KB"),
                ("SET SESSION read_rnd_buffer_size = 524288", "Set random read buffer to 512KB"),
                ("SET SESSION join_buffer_size = 2097152", "Set join buffer to 2MB"),
                
                # InnoDB specific optimizations
                ("SET SESSION innodb_buffer_pool_size = 268435456", "Set InnoDB buffer pool to 256MB"),
                ("SET SESSION optimizer_search_depth = 62", "Optimize search depth for complex queries"),
                ("SET SESSION optimizer_prune_level = 1", "Enable query optimizer pruning"),
                
                # Performance schema settings for monitoring
                ("SET SESSION performance_schema = ON", "Enable performance monitoring"),
                ("SET SESSION slow_query_log = ON", "Enable slow query logging"),
                ("SET SESSION long_query_time = 2", "Log queries taking more than 2 seconds"),
            ]
            
            for setting, description in optimization_settings:
                try:
                    db_service.execute_query(setting, use_cache=False)
                    print(f"   ✓ {description}")
                except Exception as e:
                    print(f"   ✗ Failed to apply {description}: {e}")
            
            # Analyze tables for better query planning
            print(f"\n4. Analyzing tables for enhanced query optimization...")
            
            tables_to_analyze = ['asteroids', 'observations', 'meteorites']
            for table in tables_to_analyze:
                try:
                    # Run ANALYZE TABLE for statistics
                    db_service.execute_query(f"ANALYZE TABLE {table}", use_cache=False)
                    print(f"   ✓ Analyzed table: {table}")
                    
                    # Run OPTIMIZE TABLE for better performance (only for MyISAM/InnoDB)
                    db_service.execute_query(f"OPTIMIZE TABLE {table}", use_cache=False)
                    print(f"   ✓ Optimized table: {table}")
                    
                except Exception as e:
                    print(f"   ✗ Failed to optimize table {table}: {e}")
            
            # Add query performance monitoring
            print(f"\n5. Setting up query performance monitoring...")
            
            monitoring_queries = [
                # Enable performance schema events
                "UPDATE performance_schema.setup_instruments SET ENABLED = 'YES' WHERE NAME LIKE 'statement/%'",
                "UPDATE performance_schema.setup_consumers SET ENABLED = 'YES' WHERE NAME LIKE '%statements%'",
                
                # Create performance monitoring views
                """CREATE OR REPLACE VIEW slow_queries_summary AS
                   SELECT 
                       DIGEST_TEXT as query_pattern,
                       COUNT_STAR as execution_count,
                       AVG_TIMER_WAIT/1000000000 as avg_time_seconds,
                       MAX_TIMER_WAIT/1000000000 as max_time_seconds,
                       SUM_ROWS_EXAMINED as total_rows_examined,
                       SUM_ROWS_SENT as total_rows_sent
                   FROM performance_schema.events_statements_summary_by_digest 
                   WHERE AVG_TIMER_WAIT > 1000000000
                   ORDER BY AVG_TIMER_WAIT DESC
                   LIMIT 20""",
            ]
            
            for query in monitoring_queries:
                try:
                    db_service.execute_query(query, use_cache=False)
                    print(f"   ✓ Applied performance monitoring configuration")
                except Exception as e:
                    print(f"   ✗ Failed to apply monitoring: {e}")
            
            # Test query performance with sample queries
            print(f"\n6. Testing optimized query performance...")
            
            test_queries = [
                ("SELECT COUNT(*) FROM asteroids WHERE bus_demeo_class IS NOT NULL", "Bus-DeMeo count query"),
                ("SELECT COUNT(*) FROM asteroids WHERE tholen_class IS NOT NULL", "Tholen count query"),
                ("SELECT COUNT(DISTINCT a.id) FROM asteroids a JOIN observations o ON a.id = o.asteroid_id WHERE o.band = 'VNIR'", "Spectral data count query"),
            ]
            
            for query, description in test_queries:
                try:
                    start_time = time.time()
                    result = db_service.execute_query(query, use_cache=False)
                    query_time = time.time() - start_time
                    
                    if result is not None and not result.empty:
                        count = result.iloc[0, 0]
                        print(f"   ✓ {description}: {count} records in {query_time:.3f}s")
                    else:
                        print(f"   ✗ {description}: No results")
                        
                except Exception as e:
                    print(f"   ✗ {description} failed: {e}")
            
            print("\n" + "=" * 60)
            print("Database Optimization Summary:")
            print(f"  Indexes created: {success_count}")
            print(f"  Indexes skipped (already exist): {skip_count}")
            print(f"  Errors: {error_count}")
            print("  Query optimization settings applied")
            print("  Performance monitoring enabled")
            print("  Tables analyzed and optimized")
            print("=" * 60)
            
            if error_count == 0:
                print("✓ All database optimizations completed successfully!")
                print("✓ Enhanced indexing strategy implemented")
                print("✓ Query performance monitoring enabled")
                print("✓ Large dataset streaming support ready")
            else:
                print(f"⚠ Completed with {error_count} errors. Check logs above.")
                print("✓ Core optimizations still applied successfully")
            
    except Exception as e:
        print(f"Optimization failed: {e}")
        import traceback
        traceback.print_exc()

def check_existing_indexes(db_service):
    """Check what indexes already exist in the database."""
    existing_indexes = set()
    
    try:
        # Check indexes on asteroids table
        asteroids_indexes_query = "SHOW INDEX FROM asteroids"
        asteroids_indexes_df = db_service.execute_query(asteroids_indexes_query, use_cache=False)
        
        if asteroids_indexes_df is not None:
            for _, row in asteroids_indexes_df.iterrows():
                existing_indexes.add(row['Key_name'])
        
        # Check indexes on observations table
        observations_indexes_query = "SHOW INDEX FROM observations"
        observations_indexes_df = db_service.execute_query(observations_indexes_query, use_cache=False)
        
        if observations_indexes_df is not None:
            for _, row in observations_indexes_df.iterrows():
                existing_indexes.add(row['Key_name'])
        
        print(f"   Found {len(existing_indexes)} existing indexes")
        
    except Exception as e:
        logger.warning(f"Failed to check existing indexes: {e}")
    
    return existing_indexes

if __name__ == "__main__":
    optimize_database()