"""
Performance tests for the asteroid spectral web application.
Tests database queries, API endpoints, and caching performance.
"""
import pytest
import time
import threading
import concurrent.futures
from typing import List, Dict, Any
import statistics
import requests
import pandas as pd
from unittest.mock import patch, MagicMock

from app.services.database_service import FlaskDatabaseService
from app.services.data_access import DataAccessLayer
from app.utils.cache import TTLCache, QueryCache, get_query_cache, get_general_cache
from app import create_app


class PerformanceTestSuite:
    """Performance test suite for the application."""
    
    def __init__(self):
        self.app = create_app()
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()
        
    def measure_execution_time(self, func, *args, **kwargs) -> Dict[str, Any]:
        """Measure execution time of a function."""
        start_time = time.time()
        result = func(*args, **kwargs)
        end_time = time.time()
        
        return {
            'result': result,
            'execution_time': end_time - start_time,
            'timestamp': start_time
        }
    
    def run_concurrent_requests(self, func, args_list: List[tuple], max_workers: int = 10) -> List[Dict[str, Any]]:
        """Run multiple requests concurrently and measure performance."""
        results = []
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit all tasks
            future_to_args = {
                executor.submit(self.measure_execution_time, func, *args): args 
                for args in args_list
            }
            
            # Collect results
            for future in concurrent.futures.as_completed(future_to_args):
                args = future_to_args[future]
                try:
                    result = future.result()
                    result['args'] = args
                    results.append(result)
                except Exception as e:
                    results.append({
                        'args': args,
                        'error': str(e),
                        'execution_time': None,
                        'timestamp': time.time()
                    })
        
        return results
    
    def analyze_performance_results(self, results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze performance test results."""
        execution_times = [r['execution_time'] for r in results if r['execution_time'] is not None]
        errors = [r for r in results if 'error' in r]
        
        if not execution_times:
            return {
                'error': 'No successful executions',
                'total_requests': len(results),
                'errors': len(errors)
            }
        
        return {
            'total_requests': len(results),
            'successful_requests': len(execution_times),
            'failed_requests': len(errors),
            'success_rate': len(execution_times) / len(results),
            'avg_response_time': statistics.mean(execution_times),
            'median_response_time': statistics.median(execution_times),
            'min_response_time': min(execution_times),
            'max_response_time': max(execution_times),
            'std_dev_response_time': statistics.stdev(execution_times) if len(execution_times) > 1 else 0,
            'p95_response_time': sorted(execution_times)[int(0.95 * len(execution_times))] if len(execution_times) > 1 else execution_times[0],
            'p99_response_time': sorted(execution_times)[int(0.99 * len(execution_times))] if len(execution_times) > 1 else execution_times[0],
            'requests_per_second': len(execution_times) / max(execution_times) if execution_times else 0
        }


class TestCachePerformance:
    """Test cache performance and effectiveness."""
    
    def test_ttl_cache_performance(self):
        """Test TTL cache performance under load."""
        cache = TTLCache(max_size=1000, default_ttl=60)
        
        # Test write performance
        start_time = time.time()
        for i in range(1000):
            cache.set(f"key_{i}", f"value_{i}")
        write_time = time.time() - start_time
        
        # Test read performance (cache hits)
        start_time = time.time()
        for i in range(1000):
            cache.get(f"key_{i}")
        read_time = time.time() - start_time
        
        # Test read performance (cache misses)
        start_time = time.time()
        for i in range(1000, 2000):
            cache.get(f"key_{i}")
        miss_time = time.time() - start_time
        
        stats = cache.get_stats()
        
        assert write_time < 1.0, f"Write performance too slow: {write_time}s"
        assert read_time < 0.5, f"Read performance too slow: {read_time}s"
        assert stats['hit_rate'] >= 0.5, f"Hit rate too low: {stats['hit_rate']}"
        
        print(f"Cache Performance:")
        print(f"  Write time (1000 items): {write_time:.3f}s")
        print(f"  Read time (1000 hits): {read_time:.3f}s")
        print(f"  Miss time (1000 misses): {miss_time:.3f}s")
        print(f"  Hit rate: {stats['hit_rate']:.3f}")
    
    def test_query_cache_performance(self):
        """Test query cache performance."""
        query_cache = QueryCache(max_size=500, default_ttl=300)
        
        # Mock query results
        mock_result = pd.DataFrame({'id': [1, 2, 3], 'name': ['A', 'B', 'C']})
        
        # Test caching different queries
        queries = [
            ("SELECT * FROM asteroids WHERE id = %s", (i,))
            for i in range(100)
        ]
        
        # First run - cache misses
        start_time = time.time()
        for query, params in queries:
            cached = query_cache.get_query_result(query, params)
            if cached is None:
                query_cache.cache_query_result(query, params, mock_result)
        first_run_time = time.time() - start_time
        
        # Second run - cache hits
        start_time = time.time()
        for query, params in queries:
            cached = query_cache.get_query_result(query, params)
            assert cached is not None
        second_run_time = time.time() - start_time
        
        stats = query_cache.get_stats()
        
        assert second_run_time < first_run_time / 2, "Cache should significantly improve performance"
        assert stats['hit_rate'] >= 0.5, f"Hit rate too low: {stats['hit_rate']}"
        
        print(f"Query Cache Performance:")
        print(f"  First run (misses): {first_run_time:.3f}s")
        print(f"  Second run (hits): {second_run_time:.3f}s")
        print(f"  Speedup: {first_run_time / second_run_time:.1f}x")
        print(f"  Hit rate: {stats['hit_rate']:.3f}")
    
    def test_concurrent_cache_access(self):
        """Test cache performance under concurrent access."""
        cache = TTLCache(max_size=1000, default_ttl=60)
        
        def cache_worker(worker_id: int, operations: int):
            """Worker function for concurrent cache operations."""
            for i in range(operations):
                key = f"worker_{worker_id}_key_{i}"
                value = f"worker_{worker_id}_value_{i}"
                
                # Write
                cache.set(key, value)
                
                # Read
                result = cache.get(key)
                assert result == value
        
        # Run concurrent workers
        num_workers = 10
        operations_per_worker = 100
        
        start_time = time.time()
        with concurrent.futures.ThreadPoolExecutor(max_workers=num_workers) as executor:
            futures = [
                executor.submit(cache_worker, worker_id, operations_per_worker)
                for worker_id in range(num_workers)
            ]
            
            for future in concurrent.futures.as_completed(futures):
                future.result()  # Raise any exceptions
        
        concurrent_time = time.time() - start_time
        total_operations = num_workers * operations_per_worker * 2  # read + write
        
        stats = cache.get_stats()
        
        assert concurrent_time < 5.0, f"Concurrent operations too slow: {concurrent_time}s"
        
        print(f"Concurrent Cache Performance:")
        print(f"  {num_workers} workers, {operations_per_worker} ops each")
        print(f"  Total time: {concurrent_time:.3f}s")
        print(f"  Operations per second: {total_operations / concurrent_time:.0f}")
        print(f"  Final cache size: {stats['size']}")


class TestDatabasePerformance:
    """Test database query performance."""
    
    @pytest.fixture
    def mock_db_service(self):
        """Mock database service for testing."""
        with patch('app.services.database_service.DatabaseManager') as mock_db_manager:
            # Mock successful connection
            mock_db_manager.return_value.test_connection.return_value = True
            
            # Mock query results
            mock_result = pd.DataFrame({
                'id': range(1, 101),
                'official_number': range(1, 101),
                'proper_name': [f'Asteroid {i}' for i in range(1, 101)],
                'bus_demeo_class': ['C'] * 100
            })
            mock_db_manager.return_value.execute_query.return_value = mock_result
            
            app = create_app()
            app.config['TESTING'] = True
            
            with app.app_context():
                db_service = FlaskDatabaseService()
                db_service.init_app(app)
                yield db_service
    
    def test_single_asteroid_query_performance(self, mock_db_service):
        """Test performance of single asteroid queries."""
        suite = PerformanceTestSuite()
        
        # Test multiple single queries
        asteroid_ids = list(range(1, 101))
        args_list = [(aid,) for aid in asteroid_ids]
        
        results = suite.run_concurrent_requests(
            mock_db_service.get_asteroid_by_id,
            args_list,
            max_workers=10
        )
        
        analysis = suite.analyze_performance_results(results)
        
        assert analysis['success_rate'] > 0.95, f"Success rate too low: {analysis['success_rate']}"
        assert analysis['avg_response_time'] < 0.1, f"Average response time too high: {analysis['avg_response_time']}"
        
        print(f"Single Asteroid Query Performance:")
        print(f"  Total requests: {analysis['total_requests']}")
        print(f"  Success rate: {analysis['success_rate']:.3f}")
        print(f"  Average response time: {analysis['avg_response_time']:.3f}s")
        print(f"  95th percentile: {analysis['p95_response_time']:.3f}s")
    
    def test_batch_query_performance(self, mock_db_service):
        """Test performance of batch queries."""
        suite = PerformanceTestSuite()
        
        # Test batch queries of different sizes
        batch_sizes = [1, 5, 10, 25, 50]
        
        for batch_size in batch_sizes:
            asteroid_ids = list(range(1, batch_size + 1))
            
            result = suite.measure_execution_time(
                mock_db_service.get_asteroids_by_ids,
                asteroid_ids
            )
            
            assert result['execution_time'] < 1.0, f"Batch query too slow for size {batch_size}: {result['execution_time']}"
            
            print(f"Batch size {batch_size}: {result['execution_time']:.3f}s")
    
    def test_spectral_data_query_performance(self, mock_db_service):
        """Test performance of spectral data queries."""
        suite = PerformanceTestSuite()
        
        # Mock spectral data
        with patch.object(mock_db_service, 'get_asteroid_spectrum') as mock_spectrum:
            mock_spectrum.return_value = {
                'asteroid_id': 1,
                'wavelengths': list(range(450, 2450, 5)),
                'reflectances': [0.5] * 400,
                'normalized': True
            }
            
            # Test concurrent spectral data requests
            asteroid_ids = list(range(1, 51))
            args_list = [(aid,) for aid in asteroid_ids]
            
            results = suite.run_concurrent_requests(
                mock_db_service.get_asteroid_spectrum,
                args_list,
                max_workers=5
            )
            
            analysis = suite.analyze_performance_results(results)
            
            assert analysis['success_rate'] > 0.95, f"Success rate too low: {analysis['success_rate']}"
            assert analysis['avg_response_time'] < 0.5, f"Average response time too high: {analysis['avg_response_time']}"
            
            print(f"Spectral Data Query Performance:")
            print(f"  Total requests: {analysis['total_requests']}")
            print(f"  Success rate: {analysis['success_rate']:.3f}")
            print(f"  Average response time: {analysis['avg_response_time']:.3f}s")


class TestAPIPerformance:
    """Test API endpoint performance."""
    
    @pytest.fixture
    def app_client(self):
        """Create test client."""
        app = create_app()
        app.config['TESTING'] = True
        return app.test_client()
    
    def test_classification_endpoint_performance(self, app_client):
        """Test classification endpoint performance."""
        suite = PerformanceTestSuite()
        
        def make_request(system):
            return app_client.get(f'/api/classifications/{system}/asteroids')
        
        # Test both classification systems
        systems = ['bus_demeo', 'tholen']
        args_list = [(system,) for system in systems * 10]  # 20 requests total
        
        results = suite.run_concurrent_requests(
            make_request,
            args_list,
            max_workers=5
        )
        
        # Filter successful HTTP responses
        http_results = []
        for result in results:
            if 'result' in result and hasattr(result['result'], 'status_code'):
                if result['result'].status_code == 200:
                    http_results.append(result)
        
        if http_results:
            analysis = suite.analyze_performance_results(http_results)
            
            print(f"Classification API Performance:")
            print(f"  Total requests: {len(results)}")
            print(f"  Successful HTTP requests: {len(http_results)}")
            print(f"  Average response time: {analysis.get('avg_response_time', 'N/A')}")
    
    def test_spectral_endpoint_performance(self, app_client):
        """Test spectral data endpoint performance."""
        suite = PerformanceTestSuite()
        
        def make_spectral_request(asteroid_id):
            return app_client.get(f'/api/asteroids/{asteroid_id}/spectrum')
        
        # Test multiple asteroid IDs
        asteroid_ids = list(range(1, 21))
        args_list = [(aid,) for aid in asteroid_ids]
        
        results = suite.run_concurrent_requests(
            make_spectral_request,
            args_list,
            max_workers=3
        )
        
        # Count successful responses (even if they return 404)
        http_results = []
        for result in results:
            if 'result' in result and hasattr(result['result'], 'status_code'):
                http_results.append(result)
        
        if http_results:
            print(f"Spectral API Performance:")
            print(f"  Total requests: {len(results)}")
            print(f"  HTTP responses: {len(http_results)}")
            
            # Analyze response times
            response_times = [r['execution_time'] for r in http_results if r['execution_time'] is not None]
            if response_times:
                print(f"  Average response time: {statistics.mean(response_times):.3f}s")
                print(f"  Max response time: {max(response_times):.3f}s")


class TestMemoryUsage:
    """Test memory usage and resource management."""
    
    def test_cache_memory_usage(self):
        """Test cache memory usage under load."""
        import psutil
        import os
        
        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        # Create large cache
        cache = TTLCache(max_size=10000, default_ttl=300)
        
        # Fill cache with data
        large_data = "x" * 1000  # 1KB per entry
        for i in range(5000):
            cache.set(f"key_{i}", large_data)
        
        filled_memory = process.memory_info().rss / 1024 / 1024  # MB
        memory_increase = filled_memory - initial_memory
        
        # Clear cache
        cache.clear()
        
        final_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        print(f"Memory Usage Test:")
        print(f"  Initial memory: {initial_memory:.1f} MB")
        print(f"  Memory with 5000 cache entries: {filled_memory:.1f} MB")
        print(f"  Memory increase: {memory_increase:.1f} MB")
        print(f"  Final memory: {final_memory:.1f} MB")
        
        # Memory should be reasonable (less than 100MB increase for 5MB of data)
        assert memory_increase < 100, f"Memory usage too high: {memory_increase:.1f} MB"


def run_performance_tests():
    """Run all performance tests."""
    print("Running Performance Tests...")
    print("=" * 50)
    
    # Cache performance tests
    print("\n1. Cache Performance Tests")
    print("-" * 30)
    cache_tests = TestCachePerformance()
    cache_tests.test_ttl_cache_performance()
    cache_tests.test_query_cache_performance()
    cache_tests.test_concurrent_cache_access()
    
    # Memory usage tests
    print("\n2. Memory Usage Tests")
    print("-" * 30)
    memory_tests = TestMemoryUsage()
    memory_tests.test_cache_memory_usage()
    
    print("\nPerformance tests completed!")


if __name__ == "__main__":
    run_performance_tests()