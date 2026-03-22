"""
Query streaming utilities for handling large datasets efficiently.
Implements streaming query execution to prevent memory issues with large result sets.
"""
import logging
import time
from typing import Iterator, Optional, Dict, Any, List, Tuple
import pandas as pd
from contextlib import contextmanager

logger = logging.getLogger(__name__)

class QueryStreamer:
    """
    Utility class for streaming large query results to prevent memory issues.
    """
    
    def __init__(self, db_service, chunk_size: int = 1000):
        """
        Initialize the query streamer.
        
        Args:
            db_service: Database service instance
            chunk_size: Number of rows to fetch per chunk
        """
        self.db_service = db_service
        self.chunk_size = chunk_size
        self.total_processed = 0
        self.start_time = None
    
    def stream_query(self, query: str, params: Optional[tuple] = None) -> Iterator[pd.DataFrame]:
        """
        Stream query execution for large result sets.
        
        Args:
            query: SQL query to execute
            params: Query parameters
            
        Yields:
            DataFrame chunks
        """
        self.start_time = time.time()
        self.total_processed = 0
        
        try:
            logger.info(f"Starting streaming query execution with chunk size {self.chunk_size}")
            
            # Get connection for streaming
            connection = self.db_service.get_connection()
            
            try:
                # Execute query with streaming cursor
                cursor = connection.cursor()
                cursor.execute(query, params or ())
                
                # Stream results in chunks
                while True:
                    rows = cursor.fetchmany(self.chunk_size)
                    if not rows:
                        break
                    
                    # Convert to DataFrame
                    columns = [desc[0] for desc in cursor.description]
                    chunk_df = pd.DataFrame(rows, columns=columns)
                    
                    self.total_processed += len(chunk_df)
                    
                    # Log progress
                    elapsed_time = time.time() - self.start_time
                    logger.debug(f"Streamed {self.total_processed} rows in {elapsed_time:.2f}s")
                    
                    yield chunk_df
                
                cursor.close()
                
            finally:
                connection.close()
            
            total_time = time.time() - self.start_time
            logger.info(f"Streaming query completed: {self.total_processed} rows in {total_time:.3f}s")
            
        except Exception as e:
            total_time = time.time() - self.start_time if self.start_time else 0
            logger.error(f"Streaming query failed after {total_time:.3f}s: {e}")
            raise
    
    def stream_classification_query(self, system: str, limit: Optional[int] = None, 
                                  offset: int = 0, per_class_limit: Optional[int] = None) -> Iterator[pd.DataFrame]:
        """
        Stream classification query results for memory-efficient processing.
        
        Args:
            system: Classification system ('bus_demeo' or 'tholen')
            limit: Maximum total number of asteroids to return
            offset: Offset for pagination
            per_class_limit: Maximum number of asteroids per classification class
            
        Yields:
            DataFrame chunks containing asteroid data
        """
        if system == 'bus_demeo':
            class_column = 'bus_demeo_class'
        elif system == 'tholen':
            class_column = 'tholen_class'
        else:
            raise ValueError(f"Invalid classification system: {system}")
        
        # Build streaming-optimized query
        if per_class_limit is not None:
            # Use window function for per-class limits
            query = f"""
                SELECT 
                    id, official_number, proper_name, provisional_designation, 
                    classification, has_spectral_data
                FROM (
                    SELECT 
                        a.id,
                        a.official_number,
                        a.proper_name,
                        a.provisional_designation,
                        a.{class_column} as classification,
                        COUNT(o.id) as has_spectral_data,
                        ROW_NUMBER() OVER (
                            PARTITION BY a.{class_column} 
                            ORDER BY a.official_number, a.id
                        ) as class_row_num
                    FROM asteroids a
                    LEFT JOIN observations o 
                        ON a.id = o.asteroid_id AND o.band = 'VNIR' AND o.spectral_data IS NOT NULL
                    WHERE a.{class_column} IS NOT NULL
                    GROUP BY a.id, a.official_number, a.proper_name, a.provisional_designation, a.{class_column}
                ) ranked
                WHERE class_row_num <= %s
                ORDER BY classification, official_number, id
            """
            
            if limit is not None:
                query += f" LIMIT {limit}"
            if offset > 0:
                query += f" OFFSET {offset}"
            
            params = (per_class_limit,)
        else:
            # Standard streaming query
            query = f"""
                SELECT 
                    a.id,
                    a.official_number,
                    a.proper_name,
                    a.provisional_designation,
                    a.{class_column} as classification,
                    COUNT(o.id) as has_spectral_data
                FROM asteroids a
                LEFT JOIN observations o 
                    ON a.id = o.asteroid_id AND o.band = 'VNIR' AND o.spectral_data IS NOT NULL
                WHERE a.{class_column} IS NOT NULL
                GROUP BY a.id, a.official_number, a.proper_name, a.provisional_designation, a.{class_column}
                ORDER BY a.{class_column}, a.official_number, a.id
            """
            
            if limit is not None:
                query += f" LIMIT {limit}"
            if offset > 0:
                query += f" OFFSET {offset}"
            
            params = None
        
        # Stream the query results
        for chunk in self.stream_query(query, params):
            yield chunk
    
    def aggregate_streamed_results(self, chunks: Iterator[pd.DataFrame], 
                                 group_by_column: str = 'classification') -> Dict[str, Any]:
        """
        Aggregate streamed results into the expected format for classification queries.
        
        Args:
            chunks: Iterator of DataFrame chunks
            group_by_column: Column to group results by
            
        Returns:
            Dictionary containing aggregated results
        """
        classes = {}
        total_returned = 0
        
        for chunk in chunks:
            if chunk.empty:
                continue
            
            # Process chunk efficiently
            for _, row in chunk.iterrows():
                class_name = str(row[group_by_column])
                if class_name not in classes:
                    classes[class_name] = []
                
                # Determine display name efficiently
                display_name = self._get_asteroid_display_name(row)
                
                classes[class_name].append({
                    'id': int(row['id']),
                    'display_name': display_name,
                    'identifiers': {
                        'official_number': int(row['official_number']) if pd.notna(row['official_number']) else None,
                        'proper_name': str(row['proper_name']) if pd.notna(row['proper_name']) else None,
                        'provisional_designation': str(row['provisional_designation']) if pd.notna(row['provisional_designation']) else None
                    },
                    'has_spectral_data': int(row['has_spectral_data']) > 0
                })
                total_returned += 1
        
        # Convert to list format
        result_classes = []
        for class_name, asteroids in classes.items():
            result_classes.append({
                'name': class_name,
                'count': len(asteroids),
                'asteroids': asteroids
            })
        
        # Sort classes by name
        result_classes.sort(key=lambda x: x['name'])
        
        return {
            'classes': result_classes,
            'total_returned': total_returned,
            'streaming_used': True
        }
    
    def _get_asteroid_display_name(self, row) -> str:
        """
        Helper method to determine asteroid display name efficiently.
        
        Args:
            row: DataFrame row containing asteroid data
            
        Returns:
            Formatted display name for the asteroid
        """
        if pd.notna(row['proper_name']) and str(row['proper_name']).strip():
            return str(row['proper_name'])
        elif pd.notna(row['official_number']):
            return f"({int(row['official_number'])})"
        elif pd.notna(row['provisional_designation']) and str(row['provisional_designation']).strip():
            return str(row['provisional_designation'])
        else:
            return f"Asteroid {int(row['id'])}"

class QueryPerformanceMonitor:
    """
    Monitor and log query performance metrics for optimization.
    """
    
    def __init__(self):
        """Initialize the performance monitor."""
        self.query_stats = {}
        self.slow_query_threshold = 2.0  # seconds
    
    def log_query_performance(self, query_hash: str, query_time: float, 
                            result_size: int, query_type: str = "unknown"):
        """
        Log query performance metrics.
        
        Args:
            query_hash: Unique identifier for the query
            query_time: Time taken to execute the query
            result_size: Number of rows returned
            query_type: Type of query (e.g., 'classification', 'spectral', 'search')
        """
        if query_type not in self.query_stats:
            self.query_stats[query_type] = {
                'total_queries': 0,
                'total_time': 0.0,
                'total_rows': 0,
                'slow_queries': 0,
                'avg_time': 0.0,
                'avg_rows': 0.0
            }
        
        stats = self.query_stats[query_type]
        stats['total_queries'] += 1
        stats['total_time'] += query_time
        stats['total_rows'] += result_size
        
        if query_time > self.slow_query_threshold:
            stats['slow_queries'] += 1
            logger.warning(f"Slow {query_type} query detected: {query_time:.3f}s, {result_size} rows")
        
        # Update averages
        stats['avg_time'] = stats['total_time'] / stats['total_queries']
        stats['avg_rows'] = stats['total_rows'] / stats['total_queries']
        
        logger.debug(f"Query performance - Type: {query_type}, Time: {query_time:.3f}s, Rows: {result_size}")
    
    def get_performance_summary(self) -> Dict[str, Any]:
        """
        Get a summary of query performance statistics.
        
        Returns:
            Dictionary containing performance statistics
        """
        return {
            'query_types': self.query_stats,
            'total_queries': sum(stats['total_queries'] for stats in self.query_stats.values()),
            'total_slow_queries': sum(stats['slow_queries'] for stats in self.query_stats.values()),
            'slow_query_threshold': self.slow_query_threshold
        }
    
    def reset_stats(self):
        """Reset all performance statistics."""
        self.query_stats = {}
        logger.info("Query performance statistics reset")

# Global performance monitor instance
performance_monitor = QueryPerformanceMonitor()

def get_performance_monitor() -> QueryPerformanceMonitor:
    """Get the global performance monitor instance."""
    return performance_monitor