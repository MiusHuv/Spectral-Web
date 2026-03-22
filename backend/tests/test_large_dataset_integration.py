#!/usr/bin/env python3
"""
Integration tests for large dataset loading behavior.
Tests the complete data loading pipeline with realistic large datasets.
"""

import pytest
import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
import json
import os
import sys
from unittest.mock import patch, Mock

# Add path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.services.database_service import FlaskDatabaseService
from app.services.data_access import DataAccessLayer

class TestLargeDatasetIntegration:
    """Integration tests for large dataset handling"""
    
    @pytest.fixture
    def app(self):
        """Create test Flask app"""
        app = create_app()
        app.config['TESTING'] = True
        app.config['DB_POOL_SIZE'] = 20  # Increase pool size for testing
        return app
    
    @pytest.fixture
    def client(self, app):
        """Create test client"""
        return app.test_client()
    
    def test_large_dataset_api_response_time(self, client):
        """Test API response times with large datasets"""
        # Test classification metadata endpoint
        start_time = time.time()
        response = client.get('/api/classifications/bus_demeo/metadata')
        metadata_time = time.time() - start_time
        
        assert response.status_code == 200
        assert metadata_time < 2.0  # Should respond within 2 seconds
        
        data = json.loads(response.data)
        assert 'metadata' in data
        assert 'classes' in data['metadata']
        
        # Find a large classification for further testing
        large_classes = [
            cls for cls in data['metadata']['classes'] 
            if cls.get('total_count', 0) > 1000
        ]
        
        if large_classes:
            test_class = large_classes[0]['name']
            
            # Test loading large classification
            start_time = time.time()
            response = client.get(f'/api/classifications/bus_demeo/{test_class}/asteroids?limit=1000')
            load_time = time.time() - start_time
            
            assert response.status_code == 200
            assert load_time < 5.0  # Should load within 5 seconds
            
            data = json.loads(response.data)
            assert 'asteroids' in data
            assert 'pagination' in data
            assert len(data['asteroids']) <= 1000
    
    def test_pagination_with_5000_plus_asteroids(self, client):
        """Test pagination behavior with 5000+ asteroids"""
        # Get metadata to find large classifications
        response = client.get('/api/classifications/bus_demeo/metadata')
        assert response.status_code == 200
        
        metadata = json.loads(response.data)['metadata']
        total_asteroids = metadata.get('total_asteroids', 0)
        
        if total_asteroids >= 5000:
            # Test unlimited query (should apply safety limits)
            start_time = time.time()
            response = client.get('/api/classifications/bus_demeo/asteroids')
            unlimited_time = time.time() - start_time
            
            assert response.status_code == 200
            assert unlimited_time < 10.0  # Should complete within 10 seconds
            
            data = json.loads(response.data)
            assert 'classes' in data
            assert 'pagination' in data
            
            # Should have pagination info
            pagination = data['pagination']
            assert 'total' in pagination
            assert 'total_returned' in pagination
            assert 'has_more' in pagination
            
            # Should apply safety limits for very large datasets
            if pagination['total'] > 20000:
                assert pagination['total_returned'] <= 20000
                assert pagination['has_more'] == True
    
    def test_concurrent_large_dataset_requests(self, client):
        """Test handling of concurrent requests for large datasets"""
        def make_request():
            start_time = time.time()
            response = client.get('/api/classifications/bus_demeo/asteroids?limit=1000')
            end_time = time.time()
            return {
                'status_code': response.status_code,
                'response_time': end_time - start_time,
                'data_size': len(response.data) if response.status_code == 200 else 0
            }
        
        # Make 10 concurrent requests
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(make_request) for _ in range(10)]
            results = [future.result() for future in as_completed(futures)]
        
        # All requests should succeed
        success_count = sum(1 for r in results if r['status_code'] == 200)
        assert success_count >= 8  # At least 80% should succeed
        
        # Response times should be reasonable
        avg_response_time = sum(r['response_time'] for r in results) / len(results)
        assert avg_response_time < 5.0  # Average should be under 5 seconds
        
        max_response_time = max(r['response_time'] for r in results)
        assert max_response_time < 10.0  # No request should take more than 10 seconds
    
    def test_memory_usage_with_large_datasets(self, client):
        """Test memory usage remains stable with large datasets"""
        import psutil
        import os
        
        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        # Make multiple requests for large datasets
        endpoints = [
            '/api/classifications/bus_demeo/asteroids?limit=2000',
            '/api/classifications/tholen/asteroids?limit=2000',
            '/api/classifications/bus_demeo/metadata',
            '/api/classifications/tholen/metadata'
        ]
        
        for _ in range(5):  # Repeat 5 times
            for endpoint in endpoints:
                response = client.get(endpoint)
                assert response.status_code == 200
        
        final_memory = process.memory_info().rss / 1024 / 1024  # MB
        memory_increase = final_memory - initial_memory
        
        # Memory increase should be reasonable (less than 200MB)
        assert memory_increase < 200, f"Memory increased by {memory_increase}MB"
    
    def test_database_connection_pool_with_large_queries(self, client):
        """Test database connection pool handles large queries efficiently"""
        def make_database_intensive_request():
            # Request that requires multiple database queries
            response = client.get('/api/classifications/bus_demeo/asteroids?limit=5000')
            return response.status_code == 200
        
        # Test with more concurrent requests than pool size
        with ThreadPoolExecutor(max_workers=25) as executor:
            futures = [executor.submit(make_database_intensive_request) for _ in range(25)]
            results = [future.result() for future in as_completed(futures)]
        
        success_count = sum(1 for r in results if r)
        success_rate = success_count / len(results)
        
        # Should handle more requests than pool size gracefully
        assert success_rate >= 0.8  # At least 80% should succeed
    
    def test_streaming_query_integration(self, client):
        """Test streaming query functionality in integration"""
        # Test endpoint that should use streaming for large results
        response = client.get('/api/classifications/bus_demeo/asteroids?limit=10000&stream=true')
        
        if response.status_code == 200:
            data = json.loads(response.data)
            
            # Should indicate streaming was used
            assert data.get('memory_optimized') == True
            
            # Should have reasonable response time even for large dataset
            # (This is tested implicitly by the request completing)
            assert 'classes' in data
            assert 'pagination' in data
    
    def test_per_class_limit_integration(self, client):
        """Test per-class limit functionality with real data"""
        response = client.get('/api/classifications/bus_demeo/asteroids?per_class_limit=50')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        
        assert 'classes' in data
        
        # Each class should have at most 50 asteroids
        for cls in data['classes']:
            assert cls['count'] <= 50
            if 'total_in_class' in cls:
                # If there are more asteroids in the class, count should be 50
                if cls['total_in_class'] > 50:
                    assert cls['count'] == 50
    
    def test_cache_performance_with_large_datasets(self, client):
        """Test caching performance with large datasets"""
        endpoint = '/api/classifications/bus_demeo/metadata'
        
        # First request (cold cache)
        start_time = time.time()
        response1 = client.get(endpoint)
        first_time = time.time() - start_time
        
        assert response1.status_code == 200
        
        # Second request (warm cache)
        start_time = time.time()
        response2 = client.get(endpoint)
        second_time = time.time() - start_time
        
        assert response2.status_code == 200
        
        # Cached response should be faster
        assert second_time < first_time * 0.8  # At least 20% faster
        
        # Data should be identical
        data1 = json.loads(response1.data)
        data2 = json.loads(response2.data)
        assert data1 == data2
    
    def test_error_handling_with_large_datasets(self, client):
        """Test error handling when dealing with large datasets"""
        # Test with invalid parameters
        response = client.get('/api/classifications/invalid_system/asteroids?limit=10000')
        assert response.status_code == 400
        
        # Test with extremely large limit (should be capped)
        response = client.get('/api/classifications/bus_demeo/asteroids?limit=1000000')
        
        if response.status_code == 200:
            data = json.loads(response.data)
            # Should apply safety limits
            assert data['pagination']['total_returned'] <= 50000  # Safety limit
        
        # Test with invalid offset
        response = client.get('/api/classifications/bus_demeo/asteroids?offset=-1')
        assert response.status_code == 400
    
    def test_spectral_data_with_large_selections(self, client):
        """Test spectral data retrieval with large asteroid selections"""
        # Get some asteroid IDs first
        response = client.get('/api/classifications/bus_demeo/asteroids?limit=100')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        asteroid_ids = []
        
        for cls in data['classes']:
            for asteroid in cls['asteroids']:
                if asteroid.get('has_spectral_data'):
                    asteroid_ids.append(asteroid['id'])
                if len(asteroid_ids) >= 20:  # Test with 20 asteroids
                    break
            if len(asteroid_ids) >= 20:
                break
        
        if len(asteroid_ids) >= 10:
            # Test batch spectral data request
            start_time = time.time()
            response = client.post('/api/spectra/batch', 
                                 json={'asteroid_ids': asteroid_ids[:10]})
            batch_time = time.time() - start_time
            
            if response.status_code == 200:
                assert batch_time < 10.0  # Should complete within 10 seconds
                
                data = json.loads(response.data)
                assert 'spectra' in data
                assert len(data['spectra']) <= 10


class TestLargeDatasetPerformanceRegression:
    """Performance regression tests for large datasets"""
    
    @pytest.fixture
    def app(self):
        """Create test Flask app"""
        app = create_app()
        app.config['TESTING'] = True
        return app
    
    @pytest.fixture
    def client(self, app):
        """Create test client"""
        return app.test_client()
    
    def test_response_time_regression(self, client):
        """Test that response times don't regress with large datasets"""
        endpoints_and_limits = [
            ('/api/classifications/bus_demeo/metadata', 1.0),  # 1 second
            ('/api/classifications/bus_demeo/asteroids?limit=100', 2.0),  # 2 seconds
            ('/api/classifications/bus_demeo/asteroids?limit=1000', 5.0),  # 5 seconds
            ('/api/classifications/bus_demeo/asteroids?limit=5000', 10.0),  # 10 seconds
        ]
        
        for endpoint, time_limit in endpoints_and_limits:
            start_time = time.time()
            response = client.get(endpoint)
            response_time = time.time() - start_time
            
            assert response.status_code == 200, f"Endpoint {endpoint} failed"
            assert response_time < time_limit, f"Endpoint {endpoint} took {response_time}s, limit was {time_limit}s"
    
    def test_throughput_regression(self, client):
        """Test that throughput doesn't regress with concurrent requests"""
        def make_request():
            start_time = time.time()
            response = client.get('/api/classifications/bus_demeo/asteroids?limit=500')
            end_time = time.time()
            return response.status_code == 200, end_time - start_time
        
        # Test with increasing concurrency
        concurrency_levels = [1, 5, 10, 15]
        
        for concurrency in concurrency_levels:
            start_time = time.time()
            
            with ThreadPoolExecutor(max_workers=concurrency) as executor:
                futures = [executor.submit(make_request) for _ in range(concurrency)]
                results = [future.result() for future in as_completed(futures)]
            
            total_time = time.time() - start_time
            success_count = sum(1 for success, _ in results if success)
            
            # Calculate throughput (requests per second)
            throughput = success_count / total_time
            
            # Throughput should not degrade significantly with concurrency
            # (This is a basic sanity check - actual values depend on hardware)
            assert throughput > 0.5, f"Throughput too low at concurrency {concurrency}: {throughput} req/s"
            assert success_count >= concurrency * 0.8, f"Too many failures at concurrency {concurrency}"


class TestLargeDatasetVisualizationIntegrity:
    """Test that visualization is not broken by large datasets"""
    
    @pytest.fixture
    def app(self):
        """Create test Flask app"""
        app = create_app()
        app.config['TESTING'] = True
        return app
    
    @pytest.fixture
    def client(self, app):
        """Create test client"""
        return app.test_client()
    
    def test_spectral_data_integrity_with_large_selections(self, client):
        """Test spectral data integrity when selecting many asteroids"""
        # Get asteroids with spectral data
        response = client.get('/api/classifications/bus_demeo/asteroids?limit=200')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        spectral_asteroids = []
        
        for cls in data['classes']:
            for asteroid in cls['asteroids']:
                if asteroid.get('has_spectral_data'):
                    spectral_asteroids.append(asteroid['id'])
                if len(spectral_asteroids) >= 50:  # Test with up to 50 asteroids
                    break
            if len(spectral_asteroids) >= 50:
                break
        
        if len(spectral_asteroids) >= 10:
            # Test batch spectral data request
            response = client.post('/api/spectra/batch', 
                                 json={'asteroid_ids': spectral_asteroids[:10]})
            
            if response.status_code == 200:
                data = json.loads(response.data)
                spectra = data.get('spectra', [])
                
                # Verify spectral data integrity
                for spectrum in spectra:
                    assert 'asteroid_id' in spectrum
                    assert 'wavelengths' in spectrum
                    assert 'reflectances' in spectrum
                    
                    # Wavelengths and reflectances should have same length
                    assert len(spectrum['wavelengths']) == len(spectrum['reflectances'])
                    
                    # Should have reasonable number of data points
                    assert len(spectrum['wavelengths']) > 10
                    assert len(spectrum['wavelengths']) < 10000  # Sanity check
                    
                    # Wavelengths should be in reasonable range (0.3-2.5 μm)
                    wavelengths = spectrum['wavelengths']
                    assert min(wavelengths) >= 0.3
                    assert max(wavelengths) <= 2.5
                    
                    # Reflectances should be positive
                    reflectances = spectrum['reflectances']
                    assert all(r >= 0 for r in reflectances)
    
    def test_classification_tree_integrity_with_large_datasets(self, client):
        """Test classification tree structure with large datasets"""
        response = client.get('/api/classifications/bus_demeo/asteroids?limit=5000')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        classes = data.get('classes', [])
        
        # Verify classification structure
        assert len(classes) > 0
        
        total_asteroids = 0
        for cls in classes:
            assert 'name' in cls
            assert 'asteroids' in cls
            assert 'count' in cls
            
            # Classification name should be valid
            assert len(cls['name']) > 0
            assert len(cls['name']) <= 10  # Reasonable length
            
            # Count should match asteroids length
            assert cls['count'] == len(cls['asteroids'])
            
            total_asteroids += cls['count']
            
            # Verify asteroid structure
            for asteroid in cls['asteroids']:
                assert 'id' in asteroid
                assert 'display_name' in asteroid
                assert isinstance(asteroid['id'], int)
                assert asteroid['id'] > 0
        
        # Should have reasonable number of asteroids
        assert total_asteroids > 0
        assert total_asteroids <= 50000  # Safety limit
    
    def test_export_functionality_with_large_selections(self, client):
        """Test export functionality with large asteroid selections"""
        # Get some asteroid IDs
        response = client.get('/api/classifications/bus_demeo/asteroids?limit=100')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        asteroid_ids = []
        
        for cls in data['classes']:
            for asteroid in cls['asteroids']:
                asteroid_ids.append(asteroid['id'])
                if len(asteroid_ids) >= 25:  # Test with 25 asteroids
                    break
            if len(asteroid_ids) >= 25:
                break
        
        if len(asteroid_ids) >= 10:
            # Test data export
            export_data = {
                'asteroid_ids': asteroid_ids[:10],
                'format': 'json'
            }
            
            response = client.post('/api/export/data', json=export_data)
            
            if response.status_code == 200:
                # Should return valid JSON or file
                if response.content_type == 'application/json':
                    exported_data = json.loads(response.data)
                    assert 'asteroids' in exported_data
                    assert len(exported_data['asteroids']) <= 10


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])