"""
Load testing for asteroid spectral web application backend
Tests API endpoints under various load conditions
"""

import pytest
import time
import threading
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from statistics import mean, median
import json
from typing import List, Dict, Any

# Test configuration
BASE_URL = "http://localhost:5000"
API_BASE = f"{BASE_URL}/api"

class LoadTestResults:
    def __init__(self):
        self.response_times: List[float] = []
        self.success_count = 0
        self.error_count = 0
        self.errors: List[str] = []
    
    def add_result(self, response_time: float, success: bool, error: str = None):
        self.response_times.append(response_time)
        if success:
            self.success_count += 1
        else:
            self.error_count += 1
            if error:
                self.errors.append(error)
    
    def get_stats(self) -> Dict[str, Any]:
        if not self.response_times:
            return {}
        
        return {
            'total_requests': len(self.response_times),
            'success_count': self.success_count,
            'error_count': self.error_count,
            'success_rate': self.success_count / len(self.response_times) * 100,
            'avg_response_time': mean(self.response_times),
            'median_response_time': median(self.response_times),
            'min_response_time': min(self.response_times),
            'max_response_time': max(self.response_times),
            'errors': self.errors[:10]  # First 10 errors
        }

def make_request(url: str, method: str = 'GET', data: Dict = None) -> tuple:
    """Make HTTP request and return (response_time, success, error)"""
    start_time = time.time()
    try:
        if method == 'GET':
            response = requests.get(url, timeout=10)
        elif method == 'POST':
            response = requests.post(url, json=data, timeout=10)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        response_time = time.time() - start_time
        success = response.status_code == 200
        error = None if success else f"HTTP {response.status_code}"
        
        return response_time, success, error
    except Exception as e:
        response_time = time.time() - start_time
        return response_time, False, str(e)

class TestLoadPerformance:
    """Load testing for API endpoints"""
    
    def test_classifications_endpoint_load(self):
        """Test classifications endpoint under load"""
        results = LoadTestResults()
        url = f"{API_BASE}/classifications"
        
        # Test with 50 concurrent requests
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(make_request, url) for _ in range(50)]
            
            for future in as_completed(futures):
                response_time, success, error = future.result()
                results.add_result(response_time, success, error)
        
        stats = results.get_stats()
        
        # Assertions
        assert stats['success_rate'] >= 95, f"Success rate too low: {stats['success_rate']}%"
        assert stats['avg_response_time'] < 2.0, f"Average response time too high: {stats['avg_response_time']}s"
        assert stats['max_response_time'] < 5.0, f"Max response time too high: {stats['max_response_time']}s"
        
        print(f"Classifications load test stats: {json.dumps(stats, indent=2)}")
    
    def test_asteroids_by_classification_load(self):
        """Test asteroids by classification endpoint under load"""
        results = LoadTestResults()
        url = f"{API_BASE}/classifications/bus_demeo/asteroids"
        
        # Test with 30 concurrent requests
        with ThreadPoolExecutor(max_workers=8) as executor:
            futures = [executor.submit(make_request, url) for _ in range(30)]
            
            for future in as_completed(futures):
                response_time, success, error = future.result()
                results.add_result(response_time, success, error)
        
        stats = results.get_stats()
        
        # Assertions
        assert stats['success_rate'] >= 90, f"Success rate too low: {stats['success_rate']}%"
        assert stats['avg_response_time'] < 3.0, f"Average response time too high: {stats['avg_response_time']}s"
        
        print(f"Asteroids by classification load test stats: {json.dumps(stats, indent=2)}")
    
    def test_spectral_data_batch_load(self):
        """Test spectral data batch endpoint under load"""
        results = LoadTestResults()
        url = f"{API_BASE}/spectra/batch"
        
        # Test data - request spectral data for multiple asteroids
        test_data = {"asteroid_ids": [1, 2, 3, 4, 5]}
        
        # Test with 20 concurrent requests
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(make_request, url, 'POST', test_data) for _ in range(20)]
            
            for future in as_completed(futures):
                response_time, success, error = future.result()
                results.add_result(response_time, success, error)
        
        stats = results.get_stats()
        
        # Assertions for spectral data (more intensive operation)
        assert stats['success_rate'] >= 85, f"Success rate too low: {stats['success_rate']}%"
        assert stats['avg_response_time'] < 5.0, f"Average response time too high: {stats['avg_response_time']}s"
        
        print(f"Spectral data batch load test stats: {json.dumps(stats, indent=2)}")
    
    def test_asteroid_details_batch_load(self):
        """Test asteroid details batch endpoint under load"""
        results = LoadTestResults()
        url = f"{API_BASE}/asteroids/batch"
        
        # Test data
        test_data = {"asteroid_ids": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
        
        # Test with 25 concurrent requests
        with ThreadPoolExecutor(max_workers=6) as executor:
            futures = [executor.submit(make_request, url, 'POST', test_data) for _ in range(25)]
            
            for future in as_completed(futures):
                response_time, success, error = future.result()
                results.add_result(response_time, success, error)
        
        stats = results.get_stats()
        
        # Assertions
        assert stats['success_rate'] >= 90, f"Success rate too low: {stats['success_rate']}%"
        assert stats['avg_response_time'] < 3.0, f"Average response time too high: {stats['avg_response_time']}s"
        
        print(f"Asteroid details batch load test stats: {json.dumps(stats, indent=2)}")
    
    def test_export_endpoint_load(self):
        """Test export endpoint under load"""
        results = LoadTestResults()
        url = f"{API_BASE}/export/data"
        
        # Test data
        test_data = {
            "asteroid_ids": [1, 2, 3],
            "format": "json"
        }
        
        # Test with 15 concurrent requests (exports are resource intensive)
        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = [executor.submit(make_request, url, 'POST', test_data) for _ in range(15)]
            
            for future in as_completed(futures):
                response_time, success, error = future.result()
                results.add_result(response_time, success, error)
        
        stats = results.get_stats()
        
        # Assertions for export (most intensive operation)
        assert stats['success_rate'] >= 80, f"Success rate too low: {stats['success_rate']}%"
        assert stats['avg_response_time'] < 10.0, f"Average response time too high: {stats['avg_response_time']}s"
        
        print(f"Export endpoint load test stats: {json.dumps(stats, indent=2)}")
    
    def test_sustained_load(self):
        """Test sustained load over time"""
        results = LoadTestResults()
        url = f"{API_BASE}/classifications"
        
        # Run requests for 30 seconds with 5 concurrent users
        end_time = time.time() + 30  # 30 seconds
        
        def make_sustained_requests():
            local_results = LoadTestResults()
            while time.time() < end_time:
                response_time, success, error = make_request(url)
                local_results.add_result(response_time, success, error)
                time.sleep(0.5)  # 2 requests per second per thread
            return local_results
        
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(make_sustained_requests) for _ in range(5)]
            
            for future in as_completed(futures):
                local_results = future.result()
                results.response_times.extend(local_results.response_times)
                results.success_count += local_results.success_count
                results.error_count += local_results.error_count
                results.errors.extend(local_results.errors)
        
        stats = results.get_stats()
        
        # Assertions for sustained load
        assert stats['success_rate'] >= 95, f"Sustained load success rate too low: {stats['success_rate']}%"
        assert stats['avg_response_time'] < 2.0, f"Sustained load avg response time too high: {stats['avg_response_time']}s"
        
        print(f"Sustained load test stats: {json.dumps(stats, indent=2)}")
    
    def test_database_connection_pool_stress(self):
        """Test database connection pool under stress"""
        results = LoadTestResults()
        
        # Mix of different endpoints to stress the connection pool
        endpoints = [
            f"{API_BASE}/classifications",
            f"{API_BASE}/classifications/bus_demeo/asteroids",
            f"{API_BASE}/classifications/tholen/asteroids"
        ]
        
        def make_mixed_requests():
            local_results = LoadTestResults()
            for endpoint in endpoints * 10:  # 30 requests per thread
                response_time, success, error = make_request(endpoint)
                local_results.add_result(response_time, success, error)
            return local_results
        
        # Test with 8 concurrent threads
        with ThreadPoolExecutor(max_workers=8) as executor:
            futures = [executor.submit(make_mixed_requests) for _ in range(8)]
            
            for future in as_completed(futures):
                local_results = future.result()
                results.response_times.extend(local_results.response_times)
                results.success_count += local_results.success_count
                results.error_count += local_results.error_count
                results.errors.extend(local_results.errors)
        
        stats = results.get_stats()
        
        # Assertions for connection pool stress
        assert stats['success_rate'] >= 90, f"Connection pool stress success rate too low: {stats['success_rate']}%"
        assert stats['avg_response_time'] < 3.0, f"Connection pool stress avg response time too high: {stats['avg_response_time']}s"
        
        print(f"Database connection pool stress test stats: {json.dumps(stats, indent=2)}")

class TestMemoryAndResourceUsage:
    """Test memory usage and resource consumption"""
    
    def test_memory_usage_under_load(self):
        """Test that memory usage remains stable under load"""
        import psutil
        import os
        
        # Get current process
        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        # Generate load
        url = f"{API_BASE}/classifications/bus_demeo/asteroids"
        
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(make_request, url) for _ in range(100)]
            
            for future in as_completed(futures):
                future.result()
        
        final_memory = process.memory_info().rss / 1024 / 1024  # MB
        memory_increase = final_memory - initial_memory
        
        # Memory increase should be reasonable (less than 100MB)
        assert memory_increase < 100, f"Memory usage increased too much: {memory_increase}MB"
        
        print(f"Memory usage - Initial: {initial_memory:.2f}MB, Final: {final_memory:.2f}MB, Increase: {memory_increase:.2f}MB")

if __name__ == "__main__":
    # Run load tests directly
    test_instance = TestLoadPerformance()
    
    print("Running load tests...")
    print("=" * 50)
    
    try:
        test_instance.test_classifications_endpoint_load()
        test_instance.test_asteroids_by_classification_load()
        test_instance.test_spectral_data_batch_load()
        test_instance.test_asteroid_details_batch_load()
        test_instance.test_export_endpoint_load()
        test_instance.test_sustained_load()
        test_instance.test_database_connection_pool_stress()
        
        memory_test = TestMemoryAndResourceUsage()
        memory_test.test_memory_usage_under_load()
        
        print("\nAll load tests completed successfully!")
        
    except Exception as e:
        print(f"Load test failed: {e}")
        raise