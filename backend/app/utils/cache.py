"""
Caching utilities for the Flask application.
Provides in-memory caching with TTL support and LRU eviction.
"""
import time
import threading
from typing import Any, Optional, Dict, Tuple, List, Union
from collections import OrderedDict
import logging
import hashlib
import json

logger = logging.getLogger(__name__)

class TTLCache:
    """
    Thread-safe in-memory cache with TTL (Time To Live) support and LRU eviction.
    """
    
    def __init__(self, max_size: int = 1000, default_ttl: int = 300):
        """
        Initialize the cache.
        
        Args:
            max_size: Maximum number of items to store
            default_ttl: Default TTL in seconds
        """
        self.max_size = max_size
        self.default_ttl = default_ttl
        self._cache: OrderedDict[str, Tuple[Any, float]] = OrderedDict()
        self._lock = threading.RLock()
        self._hits = 0
        self._misses = 0
        
    def _generate_key(self, key: Any) -> str:
        """Generate a string key from any hashable object."""
        if isinstance(key, str):
            return key
        
        # For complex objects, create a hash
        try:
            key_str = json.dumps(key, sort_keys=True, default=str)
            return hashlib.md5(key_str.encode()).hexdigest()
        except (TypeError, ValueError):
            return str(hash(key))
    
    def _cleanup_expired(self) -> None:
        """Remove expired entries from cache."""
        current_time = time.time()
        expired_keys = []
        
        for key, (value, expiry) in self._cache.items():
            if current_time > expiry:
                expired_keys.append(key)
        
        for key in expired_keys:
            del self._cache[key]
    
    def _enforce_size_limit(self) -> None:
        """Enforce cache size limit using LRU eviction."""
        while len(self._cache) > self.max_size:
            # Remove oldest item (LRU)
            self._cache.popitem(last=False)
    
    def get(self, key: Any) -> Optional[Any]:
        """
        Get value from cache.
        
        Args:
            key: Cache key
            
        Returns:
            Cached value or None if not found/expired
        """
        with self._lock:
            str_key = self._generate_key(key)
            
            if str_key not in self._cache:
                self._misses += 1
                return None
            
            value, expiry = self._cache[str_key]
            current_time = time.time()
            
            if current_time > expiry:
                # Expired
                del self._cache[str_key]
                self._misses += 1
                return None
            
            # Move to end (mark as recently used)
            self._cache.move_to_end(str_key)
            self._hits += 1
            return value
    
    def set(self, key: Any, value: Any, ttl: Optional[int] = None) -> None:
        """
        Set value in cache.
        
        Args:
            key: Cache key
            value: Value to cache
            ttl: TTL in seconds (uses default if None)
        """
        with self._lock:
            str_key = self._generate_key(key)
            ttl = ttl or self.default_ttl
            expiry = time.time() + ttl
            
            self._cache[str_key] = (value, expiry)
            self._cache.move_to_end(str_key)
            
            # Cleanup and enforce limits
            self._cleanup_expired()
            self._enforce_size_limit()
    
    def has(self, key: Any) -> bool:
        """
        Check if key exists in cache and is not expired.
        
        Args:
            key: Cache key
            
        Returns:
            True if key exists and is not expired
        """
        with self._lock:
            str_key = self._generate_key(key)
            
            if str_key not in self._cache:
                return False
            
            value, expiry = self._cache[str_key]
            current_time = time.time()
            
            if current_time > expiry:
                # Expired, remove it
                del self._cache[str_key]
                return False
            
            return True
    
    def delete(self, key: Any) -> bool:
        """
        Delete value from cache.
        
        Args:
            key: Cache key
            
        Returns:
            True if key was found and deleted
        """
        with self._lock:
            str_key = self._generate_key(key)
            if str_key in self._cache:
                del self._cache[str_key]
                return True
            return False
    
    def clear(self) -> None:
        """Clear all cached values."""
        with self._lock:
            self._cache.clear()
            self._hits = 0
            self._misses = 0
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        with self._lock:
            total_requests = self._hits + self._misses
            hit_rate = (self._hits / total_requests) if total_requests > 0 else 0
            
            return {
                'size': len(self._cache),
                'max_size': self.max_size,
                'hits': self._hits,
                'misses': self._misses,
                'hit_rate': round(hit_rate, 3),
                'total_requests': total_requests
            }
    
    def cleanup(self) -> int:
        """
        Manually cleanup expired entries.
        
        Returns:
            Number of entries removed
        """
        with self._lock:
            initial_size = len(self._cache)
            self._cleanup_expired()
            return initial_size - len(self._cache)

class QueryCache:
    """
    Specialized cache for database queries with intelligent key generation.
    """
    
    def __init__(self, max_size: int = 500, default_ttl: int = 300):
        """
        Initialize query cache.
        
        Args:
            max_size: Maximum number of cached queries
            default_ttl: Default TTL in seconds
        """
        self.cache = TTLCache(max_size, default_ttl)
    
    def _generate_query_key(self, query: str, params: Optional[tuple] = None) -> str:
        """Generate cache key for SQL query."""
        # Normalize query (remove extra whitespace, convert to lowercase)
        normalized_query = ' '.join(query.strip().lower().split())
        
        # Include parameters in key
        if params:
            key_data = {'query': normalized_query, 'params': params}
        else:
            key_data = {'query': normalized_query}
        
        return self.cache._generate_key(key_data)
    
    def get_query_result(self, query: str, params: Optional[tuple] = None) -> Optional[Any]:
        """Get cached query result."""
        key = self._generate_query_key(query, params)
        return self.cache.get(key)
    
    def cache_query_result(self, query: str, params: Optional[tuple], result: Any, ttl: Optional[int] = None) -> None:
        """Cache query result."""
        key = self._generate_query_key(query, params)
        self.cache.set(key, result, ttl)
    
    def invalidate_pattern(self, table_name: str) -> int:
        """
        Invalidate all cached queries that involve a specific table.
        
        Args:
            table_name: Name of the table
            
        Returns:
            Number of entries invalidated
        """
        with self.cache._lock:
            keys_to_remove = []
            
            for key in self.cache._cache.keys():
                # This is a simple pattern matching - could be enhanced
                if table_name.lower() in key.lower():
                    keys_to_remove.append(key)
            
            for key in keys_to_remove:
                del self.cache._cache[key]
            
            return len(keys_to_remove)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        return self.cache.get_stats()
    
    def clear(self) -> None:
        """Clear all cached queries."""
        self.cache.clear()

# Global cache instances
_query_cache = None
_general_cache = None

def get_query_cache() -> QueryCache:
    """Get the global query cache instance."""
    global _query_cache
    if _query_cache is None:
        _query_cache = QueryCache(max_size=500, default_ttl=300)  # 5 minutes default
    return _query_cache

def get_general_cache() -> TTLCache:
    """Get the global general cache instance."""
    global _general_cache
    if _general_cache is None:
        _general_cache = TTLCache(max_size=1000, default_ttl=600)  # 10 minutes default
    return _general_cache

def cache_query(ttl: int = 300):
    """
    Decorator for caching database query results.
    
    Args:
        ttl: Cache TTL in seconds
    """
    def decorator(func):
        def wrapper(*args, **kwargs):
            # Generate cache key from function name and arguments
            cache_key = {
                'function': func.__name__,
                'args': args,
                'kwargs': kwargs
            }
            
            cache = get_general_cache()
            cached_result = cache.get(cache_key)
            
            if cached_result is not None:
                logger.debug(f"Cache hit for {func.__name__}")
                return cached_result
            
            # Execute function and cache result
            result = func(*args, **kwargs)
            cache.set(cache_key, result, ttl)
            logger.debug(f"Cached result for {func.__name__}")
            
            return result
        
        return wrapper
    return decorator

def invalidate_cache_pattern(pattern: str) -> None:
    """
    Invalidate cache entries matching a pattern.
    
    Args:
        pattern: Pattern to match (simple string matching)
    """
    query_cache = get_query_cache()
    general_cache = get_general_cache()
    
    # For query cache, use table-based invalidation
    if pattern.startswith('table:'):
        table_name = pattern[6:]  # Remove 'table:' prefix
        invalidated = query_cache.invalidate_pattern(table_name)
        logger.info(f"Invalidated {invalidated} query cache entries for table {table_name}")
    
    # For general cache, we'd need more sophisticated pattern matching
    # For now, just clear the entire cache if needed
    logger.info("Cache invalidation completed")

class MultiLevelCache:
    """
    Multi-level caching system with L1 (memory) and L2 (persistent) cache layers.
    Provides intelligent cache warming and hit rate optimization.
    """
    
    def __init__(self, l1_size: int = 1000, l2_size: int = 5000, 
                 l1_ttl: int = 300, l2_ttl: int = 1800):
        """
        Initialize multi-level cache.
        
        Args:
            l1_size: L1 cache size (fast, small)
            l2_size: L2 cache size (slower, larger)
            l1_ttl: L1 cache TTL in seconds
            l2_ttl: L2 cache TTL in seconds
        """
        self.l1_cache = TTLCache(l1_size, l1_ttl)  # Fast memory cache
        self.l2_cache = TTLCache(l2_size, l2_ttl)  # Larger persistent cache
        self._access_patterns = {}  # Track access patterns for optimization
        self._warming_queue = set()  # Queue for cache warming
        self._lock = threading.RLock()
        
    def get(self, key: Any) -> Optional[Any]:
        """Get value from multi-level cache."""
        with self._lock:
            # Try L1 cache first
            value = self.l1_cache.get(key)
            if value is not None:
                self._track_access(key, 'l1_hit')
                return value
            
            # Try L2 cache
            value = self.l2_cache.get(key)
            if value is not None:
                # Promote to L1 cache
                self.l1_cache.set(key, value)
                self._track_access(key, 'l2_hit')
                return value
            
            self._track_access(key, 'miss')
            return None
    
    def set(self, key: Any, value: Any, promote_to_l1: bool = True) -> None:
        """Set value in multi-level cache."""
        with self._lock:
            # Always store in L2
            self.l2_cache.set(key, value)
            
            # Optionally promote to L1
            if promote_to_l1:
                self.l1_cache.set(key, value)
            
            self._track_access(key, 'set')
    
    def _track_access(self, key: Any, access_type: str) -> None:
        """Track access patterns for optimization."""
        str_key = self.l1_cache._generate_key(key)
        if str_key not in self._access_patterns:
            self._access_patterns[str_key] = {
                'l1_hits': 0, 'l2_hits': 0, 'misses': 0, 'sets': 0,
                'last_access': time.time(), 'frequency': 0
            }
        
        pattern = self._access_patterns[str_key]
        pattern[f'{access_type}s'] = pattern.get(f'{access_type}s', 0) + 1
        pattern['last_access'] = time.time()
        pattern['frequency'] += 1
    
    def warm_cache(self, keys_and_values: List[Tuple[Any, Any]]) -> None:
        """Warm cache with frequently accessed data."""
        with self._lock:
            for key, value in keys_and_values:
                if key not in self._warming_queue:
                    self.set(key, value, promote_to_l1=True)
                    self._warming_queue.add(key)
    
    def get_optimization_suggestions(self) -> Dict[str, Any]:
        """Get suggestions for cache optimization based on access patterns."""
        with self._lock:
            suggestions = []
            hot_keys = []
            cold_keys = []
            
            current_time = time.time()
            
            for key, pattern in self._access_patterns.items():
                total_accesses = pattern['l1_hits'] + pattern['l2_hits'] + pattern['misses']
                hit_rate = (pattern['l1_hits'] + pattern['l2_hits']) / total_accesses if total_accesses > 0 else 0
                time_since_access = current_time - pattern['last_access']
                
                if hit_rate > 0.8 and time_since_access < 3600:  # Hot data
                    hot_keys.append({'key': key, 'hit_rate': hit_rate, 'frequency': pattern['frequency']})
                elif hit_rate < 0.2 or time_since_access > 7200:  # Cold data
                    cold_keys.append({'key': key, 'hit_rate': hit_rate, 'last_access': time_since_access})
            
            if len(hot_keys) > self.l1_cache.max_size * 0.8:
                suggestions.append({
                    'type': 'increase_l1_size',
                    'current_size': self.l1_cache.max_size,
                    'suggested_size': len(hot_keys) + 100,
                    'reason': 'Many hot keys exceed L1 cache capacity'
                })
            
            if len(cold_keys) > 50:
                suggestions.append({
                    'type': 'cleanup_cold_data',
                    'cold_keys_count': len(cold_keys),
                    'reason': 'Many cold keys consuming cache space'
                })
            
            return {
                'suggestions': suggestions,
                'hot_keys': sorted(hot_keys, key=lambda x: x['frequency'], reverse=True)[:10],
                'cold_keys': sorted(cold_keys, key=lambda x: x['last_access'], reverse=True)[:10]
            }
    
    def get_stats(self) -> Dict[str, Any]:
        """Get comprehensive cache statistics."""
        with self._lock:
            l1_stats = self.l1_cache.get_stats()
            l2_stats = self.l2_cache.get_stats()
            
            total_hits = l1_stats['hits'] + l2_stats['hits']
            total_misses = l1_stats['misses'] + l2_stats['misses']
            total_requests = total_hits + total_misses
            overall_hit_rate = total_hits / total_requests if total_requests > 0 else 0
            
            return {
                'l1_cache': l1_stats,
                'l2_cache': l2_stats,
                'overall': {
                    'total_hits': total_hits,
                    'total_misses': total_misses,
                    'total_requests': total_requests,
                    'hit_rate': round(overall_hit_rate, 3),
                    'l1_hit_rate': l1_stats['hits'] / total_requests if total_requests > 0 else 0,
                    'l2_hit_rate': l2_stats['hits'] / total_requests if total_requests > 0 else 0
                },
                'access_patterns_tracked': len(self._access_patterns),
                'warming_queue_size': len(self._warming_queue)
            }
    
    def clear(self) -> None:
        """Clear all cache levels."""
        with self._lock:
            self.l1_cache.clear()
            self.l2_cache.clear()
            self._access_patterns.clear()
            self._warming_queue.clear()

class CacheInvalidationManager:
    """
    Manages cache invalidation strategies for data updates.
    """
    
    def __init__(self):
        """Initialize cache invalidation manager."""
        self._invalidation_patterns = {}
        self._dependency_graph = {}
        self._lock = threading.RLock()
    
    def register_cache_dependency(self, cache_key_pattern: str, 
                                 dependencies: List[str]) -> None:
        """
        Register cache dependencies for invalidation.
        
        Args:
            cache_key_pattern: Pattern for cache keys (e.g., 'classification_*')
            dependencies: List of data dependencies (e.g., ['asteroids', 'observations'])
        """
        with self._lock:
            self._dependency_graph[cache_key_pattern] = dependencies
    
    def invalidate_by_dependency(self, data_source: str, 
                               caches: List[Union[TTLCache, MultiLevelCache]]) -> int:
        """
        Invalidate caches based on data source changes.
        
        Args:
            data_source: Changed data source (e.g., 'asteroids', 'observations')
            caches: List of cache instances to check
            
        Returns:
            Number of cache entries invalidated
        """
        with self._lock:
            total_invalidated = 0
            
            # Find patterns that depend on this data source
            patterns_to_invalidate = []
            for pattern, dependencies in self._dependency_graph.items():
                if data_source in dependencies:
                    patterns_to_invalidate.append(pattern)
            
            # Invalidate matching cache entries
            for cache in caches:
                if isinstance(cache, MultiLevelCache):
                    # Handle multi-level cache
                    for pattern in patterns_to_invalidate:
                        total_invalidated += self._invalidate_pattern_in_cache(
                            pattern, cache.l1_cache
                        )
                        total_invalidated += self._invalidate_pattern_in_cache(
                            pattern, cache.l2_cache
                        )
                elif isinstance(cache, TTLCache):
                    # Handle single-level cache
                    for pattern in patterns_to_invalidate:
                        total_invalidated += self._invalidate_pattern_in_cache(
                            pattern, cache
                        )
            
            logger.info(f"Invalidated {total_invalidated} cache entries for data source: {data_source}")
            return total_invalidated
    
    def _invalidate_pattern_in_cache(self, pattern: str, cache: TTLCache) -> int:
        """Invalidate cache entries matching a pattern."""
        with cache._lock:
            keys_to_remove = []
            
            # Convert pattern to regex (simple wildcard support)
            import re
            regex_pattern = pattern.replace('*', '.*')
            
            for key in cache._cache.keys():
                if re.match(regex_pattern, key):
                    keys_to_remove.append(key)
            
            for key in keys_to_remove:
                cache._cache.pop(key, None)
            
            return len(keys_to_remove)

class CacheWarmingService:
    """
    Service for intelligent cache warming based on usage patterns.
    """
    
    def __init__(self, cache: MultiLevelCache):
        """Initialize cache warming service."""
        self.cache = cache
        self._warming_strategies = {}
        self._lock = threading.RLock()
    
    def register_warming_strategy(self, name: str, 
                                 data_loader_func: callable,
                                 trigger_conditions: Dict[str, Any]) -> None:
        """
        Register a cache warming strategy.
        
        Args:
            name: Strategy name
            data_loader_func: Function to load data for warming
            trigger_conditions: Conditions that trigger warming
        """
        with self._lock:
            self._warming_strategies[name] = {
                'loader': data_loader_func,
                'conditions': trigger_conditions,
                'last_run': 0,
                'run_count': 0
            }
    
    def execute_warming_strategies(self) -> Dict[str, Any]:
        """Execute applicable warming strategies."""
        with self._lock:
            results = {}
            current_time = time.time()
            
            for name, strategy in self._warming_strategies.items():
                conditions = strategy['conditions']
                
                # Check if strategy should run
                should_run = False
                
                # Time-based trigger
                if 'interval' in conditions:
                    if current_time - strategy['last_run'] >= conditions['interval']:
                        should_run = True
                
                # Hit rate trigger
                if 'min_hit_rate' in conditions:
                    stats = self.cache.get_stats()
                    if stats['overall']['hit_rate'] < conditions['min_hit_rate']:
                        should_run = True
                
                if should_run:
                    try:
                        # Execute warming strategy
                        warming_data = strategy['loader']()
                        if warming_data:
                            self.cache.warm_cache(warming_data)
                            
                        strategy['last_run'] = current_time
                        strategy['run_count'] += 1
                        
                        results[name] = {
                            'status': 'success',
                            'items_warmed': len(warming_data) if warming_data else 0,
                            'run_count': strategy['run_count']
                        }
                        
                    except Exception as e:
                        logger.error(f"Cache warming strategy '{name}' failed: {e}")
                        results[name] = {
                            'status': 'error',
                            'error': str(e)
                        }
            
            return results

# Global cache instances
_multi_level_cache = None
_invalidation_manager = None
_warming_service = None

def get_multi_level_cache() -> MultiLevelCache:
    """Get the global multi-level cache instance."""
    global _multi_level_cache
    if _multi_level_cache is None:
        _multi_level_cache = MultiLevelCache(
            l1_size=500,    # Fast L1 cache
            l2_size=2000,   # Larger L2 cache
            l1_ttl=300,     # 5 minutes L1 TTL
            l2_ttl=1800     # 30 minutes L2 TTL
        )
    return _multi_level_cache

def get_invalidation_manager() -> CacheInvalidationManager:
    """Get the global cache invalidation manager."""
    global _invalidation_manager
    if _invalidation_manager is None:
        _invalidation_manager = CacheInvalidationManager()
        
        # Register common cache dependencies
        _invalidation_manager.register_cache_dependency(
            'classification_*', ['asteroids', 'observations']
        )
        _invalidation_manager.register_cache_dependency(
            'asteroid_*', ['asteroids']
        )
        _invalidation_manager.register_cache_dependency(
            'spectrum_*', ['observations']
        )
        
    return _invalidation_manager

def get_warming_service() -> CacheWarmingService:
    """Get the global cache warming service."""
    global _warming_service
    if _warming_service is None:
        _warming_service = CacheWarmingService(get_multi_level_cache())
    return _warming_service

def setup_cache_warming_strategies():
    """Setup default cache warming strategies."""
    warming_service = get_warming_service()
    
    # Strategy 1: Warm popular classifications
    def load_popular_classifications():
        try:
            from app.services.data_access import get_data_access
            data_access = get_data_access()
            
            warming_data = []
            
            # Warm classification metadata for both systems
            for system in ['bus_demeo', 'tholen']:
                metadata = data_access.get_classification_metadata(system)
                cache_key = f'classification_metadata_{system}'
                warming_data.append((cache_key, metadata))
            
            return warming_data
        except Exception as e:
            logger.error(f"Failed to load popular classifications for warming: {e}")
            return []
    
    warming_service.register_warming_strategy(
        'popular_classifications',
        load_popular_classifications,
        {'interval': 3600, 'min_hit_rate': 0.7}  # Run hourly or if hit rate < 70%
    )
    
    # Strategy 2: Warm frequently accessed asteroid data
    def load_frequent_asteroids():
        try:
            # This would be enhanced with actual usage analytics
            # For now, warm some common asteroid data
            return []  # Placeholder
        except Exception as e:
            logger.error(f"Failed to load frequent asteroids for warming: {e}")
            return []
    
    warming_service.register_warming_strategy(
        'frequent_asteroids',
        load_frequent_asteroids,
        {'interval': 7200}  # Run every 2 hours
    )

def invalidate_cache_by_data_change(data_source: str) -> int:
    """
    Invalidate caches when data changes.
    
    Args:
        data_source: The data source that changed
        
    Returns:
        Number of cache entries invalidated
    """
    invalidation_manager = get_invalidation_manager()
    multi_level_cache = get_multi_level_cache()
    query_cache = get_query_cache()
    general_cache = get_general_cache()
    
    return invalidation_manager.invalidate_by_dependency(
        data_source, 
        [multi_level_cache, query_cache.cache, general_cache]
    )

def get_comprehensive_cache_stats() -> Dict[str, Any]:
    """Get comprehensive statistics for all caches."""
    query_cache = get_query_cache()
    general_cache = get_general_cache()
    multi_level_cache = get_multi_level_cache()
    
    stats = {
        'query_cache': query_cache.get_stats(),
        'general_cache': general_cache.get_stats(),
        'multi_level_cache': multi_level_cache.get_stats(),
        'optimization_suggestions': multi_level_cache.get_optimization_suggestions()
    }
    
    # Calculate overall system cache performance
    total_hits = (stats['query_cache']['hits'] + 
                 stats['general_cache']['hits'] + 
                 stats['multi_level_cache']['overall']['total_hits'])
    total_misses = (stats['query_cache']['misses'] + 
                   stats['general_cache']['misses'] + 
                   stats['multi_level_cache']['overall']['total_misses'])
    total_requests = total_hits + total_misses
    
    stats['system_overall'] = {
        'total_hits': total_hits,
        'total_misses': total_misses,
        'total_requests': total_requests,
        'overall_hit_rate': round(total_hits / total_requests, 3) if total_requests > 0 else 0,
        'cache_efficiency': 'excellent' if total_hits / total_requests > 0.8 else 
                           'good' if total_hits / total_requests > 0.6 else 
                           'needs_improvement'
    }
    
    return stats

def get_cache_stats() -> Dict[str, Any]:
    """Get statistics for all caches (backward compatibility)."""
    return get_comprehensive_cache_stats()