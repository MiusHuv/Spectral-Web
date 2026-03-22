"""
Tests for the enhanced caching system.
"""
import pytest
import time
import threading
from unittest.mock import Mock, patch
from app.utils.cache import (
    TTLCache, QueryCache, MultiLevelCache, CacheInvalidationManager,
    CacheWarmingService, get_multi_level_cache, get_invalidation_manager,
    get_warming_service, invalidate_cache_by_data_change
)

class TestTTLCache:
    """Test TTL cache functionality."""
    
    def test_basic_operations(self):
        """Test basic cache operations."""
        cache = TTLCache(max_size=10, default_ttl=1)
        
        # Test set and get
        cache.set('key1', 'value1')
        assert cache.get('key1') == 'value1'
        
        # Test has
        assert cache.has('key1') is True
        assert cache.has('nonexistent') is False
        
        # Test delete
        assert cache.delete('key1') is True
        assert cache.get('key1') is None
        assert cache.delete('nonexistent') is False
    
    def test_ttl_expiration(self):
        """Test TTL expiration."""
        cache = TTLCache(max_size=10, default_ttl=0.1)  # 100ms TTL
        
        cache.set('key1', 'value1')
        assert cache.get('key1') == 'value1'
        
        # Wait for expiration
        time.sleep(0.15)
        assert cache.get('key1') is None
    
    def test_lru_eviction(self):
        """Test LRU eviction when cache is full."""
        cache = TTLCache(max_size=3, default_ttl=10)
        
        # Fill cache
        cache.set('key1', 'value1')
        cache.set('key2', 'value2')
        cache.set('key3', 'value3')
        
        # Access key1 to make it recently used
        cache.get('key1')
        
        # Add new item, should evict key2 (least recently used)
        cache.set('key4', 'value4')
        
        assert cache.get('key1') == 'value1'  # Still there
        assert cache.get('key2') is None      # Evicted
        assert cache.get('key3') == 'value3'  # Still there
        assert cache.get('key4') == 'value4'  # New item
    
    def test_stats(self):
        """Test cache statistics."""
        cache = TTLCache(max_size=10, default_ttl=10)
        
        # Initial stats
        stats = cache.get_stats()
        assert stats['hits'] == 0
        assert stats['misses'] == 0
        assert stats['hit_rate'] == 0
        
        # Add some data and access
        cache.set('key1', 'value1')
        cache.get('key1')  # Hit
        cache.get('key2')  # Miss
        
        stats = cache.get_stats()
        assert stats['hits'] == 1
        assert stats['misses'] == 1
        assert stats['hit_rate'] == 0.5
    
    def test_thread_safety(self):
        """Test thread safety of cache operations."""
        cache = TTLCache(max_size=100, default_ttl=10)
        results = []
        
        def worker(thread_id):
            for i in range(10):
                key = f'thread_{thread_id}_key_{i}'
                value = f'thread_{thread_id}_value_{i}'
                cache.set(key, value)
                retrieved = cache.get(key)
                results.append(retrieved == value)
        
        threads = []
        for i in range(5):
            thread = threading.Thread(target=worker, args=(i,))
            threads.append(thread)
            thread.start()
        
        for thread in threads:
            thread.join()
        
        # All operations should have succeeded
        assert all(results)

class TestMultiLevelCache:
    """Test multi-level cache functionality."""
    
    def test_cache_levels(self):
        """Test L1 and L2 cache interaction."""
        cache = MultiLevelCache(l1_size=2, l2_size=5, l1_ttl=10, l2_ttl=20)
        
        # Set data
        cache.set('key1', 'value1', promote_to_l1=True)
        cache.set('key2', 'value2', promote_to_l1=False)
        
        # key1 should be in both L1 and L2
        assert cache.l1_cache.get('key1') == 'value1'
        assert cache.l2_cache.get('key1') == 'value1'
        
        # key2 should only be in L2
        assert cache.l1_cache.get('key2') is None
        assert cache.l2_cache.get('key2') == 'value2'
        
        # Get should return from appropriate level
        assert cache.get('key1') == 'value1'  # From L1
        assert cache.get('key2') == 'value2'  # From L2, promoted to L1
        assert cache.l1_cache.get('key2') == 'value2'  # Now in L1
    
    def test_access_tracking(self):
        """Test access pattern tracking."""
        cache = MultiLevelCache(l1_size=5, l2_size=10, l1_ttl=10, l2_ttl=20)
        
        # Access patterns should be tracked
        cache.set('key1', 'value1')
        cache.get('key1')
        cache.get('key1')
        cache.get('key1')
        
        # Check if access patterns are recorded
        assert 'key1' in [key for key in cache._access_patterns.keys() if 'key1' in key]
    
    def test_optimization_suggestions(self):
        """Test cache optimization suggestions."""
        cache = MultiLevelCache(l1_size=2, l2_size=5, l1_ttl=10, l2_ttl=20)
        
        # Fill cache beyond L1 capacity
        for i in range(5):
            cache.set(f'key{i}', f'value{i}', promote_to_l1=True)
        
        suggestions = cache.get_optimization_suggestions()
        assert 'suggestions' in suggestions
        assert 'hot_keys' in suggestions

class TestCacheInvalidationManager:
    """Test cache invalidation functionality."""
    
    def test_dependency_registration(self):
        """Test cache dependency registration."""
        manager = CacheInvalidationManager()
        
        manager.register_cache_dependency('asteroid_*', ['asteroids'])
        manager.register_cache_dependency('spectrum_*', ['observations'])
        
        assert 'asteroid_*' in manager._dependency_graph
        assert 'spectrum_*' in manager._dependency_graph
    
    def test_invalidation_by_dependency(self):
        """Test cache invalidation based on dependencies."""
        manager = CacheInvalidationManager()
        manager.register_cache_dependency('asteroid_*', ['asteroids'])
        
        # Create mock cache
        mock_cache = TTLCache(max_size=10, default_ttl=10)
        mock_cache.set('asteroid_123', 'data')
        mock_cache.set('spectrum_456', 'data')
        
        # Invalidate based on asteroids dependency
        invalidated = manager.invalidate_by_dependency('asteroids', [mock_cache])
        
        # Should have invalidated asteroid_* entries
        assert invalidated > 0
        assert mock_cache.get('asteroid_123') is None
        assert mock_cache.get('spectrum_456') == 'data'  # Should remain

class TestCacheWarmingService:
    """Test cache warming functionality."""
    
    def test_strategy_registration(self):
        """Test warming strategy registration."""
        cache = MultiLevelCache()
        service = CacheWarmingService(cache)
        
        def mock_loader():
            return [('key1', 'value1'), ('key2', 'value2')]
        
        service.register_warming_strategy(
            'test_strategy',
            mock_loader,
            {'interval': 1000}
        )
        
        assert 'test_strategy' in service._warming_strategies
    
    def test_strategy_execution(self):
        """Test warming strategy execution."""
        cache = MultiLevelCache()
        service = CacheWarmingService(cache)
        
        def mock_loader():
            return [('key1', 'value1'), ('key2', 'value2')]
        
        service.register_warming_strategy(
            'test_strategy',
            mock_loader,
            {'interval': 0}  # Always run
        )
        
        results = service.execute_warming_strategies()
        
        assert 'test_strategy' in results
        assert results['test_strategy']['status'] == 'success'
        assert cache.get('key1') == 'value1'
        assert cache.get('key2') == 'value2'

class TestCacheIntegration:
    """Test cache system integration."""
    
    def test_global_cache_instances(self):
        """Test global cache instance creation."""
        multi_level = get_multi_level_cache()
        invalidation = get_invalidation_manager()
        warming = get_warming_service()
        
        assert isinstance(multi_level, MultiLevelCache)
        assert isinstance(invalidation, CacheInvalidationManager)
        assert isinstance(warming, CacheWarmingService)
        
        # Should return same instances on subsequent calls
        assert get_multi_level_cache() is multi_level
        assert get_invalidation_manager() is invalidation
        assert get_warming_service() is warming
    
    def test_cache_invalidation_integration(self):
        """Test integrated cache invalidation."""
        # This would test the full invalidation flow
        # For now, just test that the function exists and runs
        result = invalidate_cache_by_data_change('asteroids')
        assert isinstance(result, int)
        assert result >= 0

class TestQueryCache:
    """Test query-specific cache functionality."""
    
    def test_query_key_generation(self):
        """Test SQL query key generation."""
        cache = QueryCache(max_size=10, default_ttl=10)
        
        query1 = "SELECT * FROM asteroids WHERE id = %s"
        query2 = "select * from asteroids where id = %s"  # Different case
        params = (123,)
        
        # Should generate same key for equivalent queries
        key1 = cache._generate_query_key(query1, params)
        key2 = cache._generate_query_key(query2, params)
        assert key1 == key2
    
    def test_query_caching(self):
        """Test query result caching."""
        cache = QueryCache(max_size=10, default_ttl=10)
        
        query = "SELECT * FROM asteroids WHERE id = %s"
        params = (123,)
        result = [{'id': 123, 'name': 'Asteroid'}]
        
        # Cache result
        cache.cache_query_result(query, params, result)
        
        # Retrieve result
        cached_result = cache.get_query_result(query, params)
        assert cached_result == result
    
    def test_table_invalidation(self):
        """Test table-based cache invalidation."""
        cache = QueryCache(max_size=10, default_ttl=10)
        
        # Cache some queries
        cache.cache_query_result("SELECT * FROM asteroids", None, [])
        cache.cache_query_result("SELECT * FROM observations", None, [])
        
        # Invalidate asteroids table
        invalidated = cache.invalidate_pattern('asteroids')
        
        # Should have invalidated queries involving asteroids
        assert invalidated > 0

if __name__ == '__main__':
    pytest.main([__file__])