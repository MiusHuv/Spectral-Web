#!/usr/bin/env python3
"""
Comprehensive unit tests for pagination logic with large datasets.
Tests backend pagination functionality under various conditions.
"""

import pytest
import time
from unittest.mock import Mock, patch, MagicMock
import sys
import os

# Add path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.data_access import DataAccessLayer
from app.services.database_service import FlaskDatabaseService
from app.utils.query_streaming import QueryStreamer

class TestLargeDatasetPagination:
    """Test pagination logic with large datasets"""
    
    @pytest.fixture
    def mock_db_service(self):
        """Mock database service for testing"""
        db_service = Mock(spec=FlaskDatabaseService)
        return db_service
    
    @pytest.fixture
    def data_access(self, mock_db_service):
        """Create DataAccessLayer with mocked database"""
        with patch('app.services.data_access.get_database_service', return_value=mock_db_service):
            return DataAccessLayer()
    
    def test_pagination_with_small_dataset(self, data_access, mock_db_service):
        """Test pagination with small dataset (< 1000 items)"""
        import pandas as pd
        
        # Mock count query response
        count_df = pd.DataFrame([
            {'classification': 'C', 'total_count': 100}
        ])
        
        # Mock asteroid data response
        asteroid_df = pd.DataFrame([
            {
                'id': i, 
                'official_number': i, 
                'proper_name': f'Asteroid {i}', 
                'bus_demeo_class': 'C',
                'has_spectral_data': True
            }
            for i in range(1, 51)  # First 50 asteroids
        ])
        
        # Configure mock to return different responses for different queries
        def mock_execute_query(query, **kwargs):
            if 'COUNT(*)' in query:
                return count_df
            else:
                return asteroid_df
        
        mock_db_service.execute_query.side_effect = mock_execute_query
        
        result = data_access.get_asteroids_by_classification('bus_demeo', limit=50, offset=0)
        
        assert 'classes' in result
        assert 'pagination' in result
        assert len(result['classes']) > 0
        
        # Check that we got the expected class
        c_class = next((cls for cls in result['classes'] if cls['name'] == 'C'), None)
        assert c_class is not None
        assert c_class['total_in_class'] == 100
    
    def test_pagination_with_large_dataset(self, data_access, mock_db_service):
        """Test pagination with large dataset (> 5000 items)"""
        import pandas as pd
        
        # Mock count query response for large dataset
        count_df = pd.DataFrame([
            {'classification': 'C', 'total_count': 5000}
        ])
        
        # Mock asteroid data response (first 1000)
        asteroid_df = pd.DataFrame([
            {
                'id': i, 
                'official_number': i, 
                'proper_name': f'Asteroid {i}', 
                'bus_demeo_class': 'C',
                'has_spectral_data': True
            }
            for i in range(1, 1001)  # First 1000 asteroids
        ])
        
        def mock_execute_query(query, **kwargs):
            if 'COUNT(*)' in query:
                return count_df
            else:
                return asteroid_df
        
        mock_db_service.execute_query.side_effect = mock_execute_query
        
        result = data_access.get_asteroids_by_classification('bus_demeo', limit=1000, offset=0)
        
        assert 'classes' in result
        assert 'pagination' in result
        
        # Check pagination metadata
        pagination = result['pagination']
        assert pagination['total_available'] == 5000
        assert pagination['total_returned'] <= 1000
    
    def test_unlimited_query_with_safety_limit(self, data_access, mock_db_service):
        """Test unlimited query applies safety limit for very large datasets"""
        # Mock database response for very large dataset
        mock_db_service.execute_query_single.return_value = {'total': 50000}
        
        # Mock streaming query for safety limit
        mock_asteroids = [
            {'id': i, 'official_number': i, 'proper_name': f'Asteroid {i}', 'bus_demeo_class': 'C'}
            for i in range(1, 20001)  # 20000 asteroids (safety limit)
        ]
        mock_db_service.execute_query.return_value = mock_asteroids
        
        result = data_access.get_asteroids_by_classification('bus_demeo', limit=None)
        
        assert result['pagination']['total'] == 50000
        assert result['pagination']['total_returned'] == 20000  # Safety limit applied
        assert result['pagination']['has_more'] == True
        assert result.get('memory_optimized') == True
    
    def test_per_class_limit_functionality(self, data_access, mock_db_service):
        """Test per-class limit with multiple classifications"""
        # Mock database response with multiple classes
        mock_asteroids = []
        classes = ['C', 'S', 'X', 'M', 'P']
        for i, cls in enumerate(classes):
            for j in range(200):  # 200 asteroids per class
                mock_asteroids.append({
                    'id': i * 200 + j + 1,
                    'official_number': i * 200 + j + 1,
                    'proper_name': f'Asteroid {i * 200 + j + 1}',
                    'bus_demeo_class': cls
                })
        
        mock_db_service.execute_query.return_value = mock_asteroids
        mock_db_service.execute_query_single.return_value = {'total': 1000}
        
        result = data_access.get_asteroids_by_classification(
            'bus_demeo', limit=None, per_class_limit=50
        )
        
        # Should have 5 classes with 50 asteroids each
        assert len(result['classes']) == 5
        for cls in result['classes']:
            assert cls['count'] <= 50
            assert cls['total_in_class'] == 200
    
    def test_streaming_query_performance(self, data_access, mock_db_service):
        """Test that streaming queries are used for large datasets"""
        # Mock large dataset that should trigger streaming
        mock_db_service.execute_query_single.return_value = {'total': 15000}
        
        # Mock streaming behavior
        with patch('app.services.data_access.QueryStreamer') as mock_streamer:
            mock_streamer_instance = Mock()
            mock_streamer_instance.stream_results.return_value = [
                {'id': i, 'official_number': i, 'proper_name': f'Asteroid {i}', 'bus_demeo_class': 'C'}
                for i in range(1, 10001)
            ]
            mock_streamer.return_value = mock_streamer_instance
            
            result = data_access.get_asteroids_by_classification(
                'bus_demeo', limit=10000, stream_results=True
            )
            
            # Verify streaming was used
            mock_streamer.assert_called_once()
            mock_streamer_instance.stream_results.assert_called_once()
            assert result.get('memory_optimized') == True
    
    def test_pagination_edge_cases(self, data_access, mock_db_service):
        """Test pagination edge cases"""
        # Test offset beyond dataset
        mock_db_service.execute_query.return_value = []
        mock_db_service.execute_query_single.return_value = {'total': 100}
        
        result = data_access.get_asteroids_by_classification('bus_demeo', limit=50, offset=200)
        
        assert result['pagination']['total'] == 100
        assert result['pagination']['offset'] == 200
        assert result['pagination']['has_more'] == False
        assert len(result['classes']) == 0 or all(len(cls['asteroids']) == 0 for cls in result['classes'])
    
    def test_pagination_performance_metrics(self, data_access, mock_db_service):
        """Test that pagination includes performance metrics"""
        mock_asteroids = [
            {'id': i, 'official_number': i, 'proper_name': f'Asteroid {i}', 'bus_demeo_class': 'C'}
            for i in range(1, 1001)
        ]
        
        mock_db_service.execute_query.return_value = mock_asteroids
        mock_db_service.execute_query_single.return_value = {'total': 1000}
        
        start_time = time.time()
        result = data_access.get_asteroids_by_classification('bus_demeo', limit=1000, offset=0)
        
        # Should include timing information
        assert 'query_time' in result.get('metadata', {})
        assert result['metadata']['query_time'] > 0
    
    def test_cache_behavior_with_pagination(self, data_access, mock_db_service):
        """Test caching behavior with paginated results"""
        mock_asteroids = [
            {'id': i, 'official_number': i, 'proper_name': f'Asteroid {i}', 'bus_demeo_class': 'C'}
            for i in range(1, 101)
        ]
        
        mock_db_service.execute_query.return_value = mock_asteroids
        mock_db_service.execute_query_single.return_value = {'total': 100}
        
        # First request
        result1 = data_access.get_asteroids_by_classification('bus_demeo', limit=50, offset=0)
        
        # Second identical request should use cache
        result2 = data_access.get_asteroids_by_classification('bus_demeo', limit=50, offset=0)
        
        # Results should be identical
        assert result1['pagination'] == result2['pagination']
        assert len(result1['classes']) == len(result2['classes'])
    
    def test_memory_optimization_flags(self, data_access, mock_db_service):
        """Test memory optimization flags are set correctly"""
        # Small dataset - no optimization needed
        mock_db_service.execute_query.return_value = [
            {'id': i, 'official_number': i, 'proper_name': f'Asteroid {i}', 'bus_demeo_class': 'C'}
            for i in range(1, 101)
        ]
        mock_db_service.execute_query_single.return_value = {'total': 100}
        
        result_small = data_access.get_asteroids_by_classification('bus_demeo', limit=100)
        assert result_small.get('memory_optimized') == False
        
        # Large dataset - optimization should be enabled
        mock_db_service.execute_query_single.return_value = {'total': 10000}
        
        result_large = data_access.get_asteroids_by_classification('bus_demeo', limit=5000)
        assert result_large.get('memory_optimized') == True
    
    def test_concurrent_pagination_requests(self, data_access, mock_db_service):
        """Test handling of concurrent pagination requests"""
        import threading
        import queue
        
        mock_asteroids = [
            {'id': i, 'official_number': i, 'proper_name': f'Asteroid {i}', 'bus_demeo_class': 'C'}
            for i in range(1, 1001)
        ]
        
        mock_db_service.execute_query.return_value = mock_asteroids
        mock_db_service.execute_query_single.return_value = {'total': 1000}
        
        results_queue = queue.Queue()
        
        def make_request(offset):
            try:
                result = data_access.get_asteroids_by_classification(
                    'bus_demeo', limit=100, offset=offset
                )
                results_queue.put(('success', offset, result))
            except Exception as e:
                results_queue.put(('error', offset, str(e)))
        
        # Start 10 concurrent requests
        threads = []
        for i in range(10):
            thread = threading.Thread(target=make_request, args=(i * 100,))
            threads.append(thread)
            thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join()
        
        # Check results
        success_count = 0
        while not results_queue.empty():
            status, offset, result = results_queue.get()
            if status == 'success':
                success_count += 1
                assert result['pagination']['offset'] == offset
        
        assert success_count == 10  # All requests should succeed


class TestQueryStreaming:
    """Test query streaming functionality for large datasets"""
    
    def test_query_streamer_initialization(self):
        """Test QueryStreamer initialization"""
        mock_db_service = Mock()
        streamer = QueryStreamer(mock_db_service)
        
        assert streamer.db_service == mock_db_service
        assert streamer.chunk_size == 1000  # Default chunk size
    
    def test_streaming_large_result_set(self):
        """Test streaming of large result sets"""
        mock_db_service = Mock()
        
        # Mock chunked results
        chunk1 = [{'id': i} for i in range(1, 1001)]
        chunk2 = [{'id': i} for i in range(1001, 2001)]
        chunk3 = [{'id': i} for i in range(2001, 2501)]
        
        mock_db_service.execute_query.side_effect = [chunk1, chunk2, chunk3, []]
        
        streamer = QueryStreamer(mock_db_service, chunk_size=1000)
        
        query = "SELECT * FROM asteroids WHERE bus_demeo_class = %s"
        params = ('C',)
        
        results = list(streamer.stream_results(query, params, max_results=2500))
        
        assert len(results) == 2500
        assert results[0]['id'] == 1
        assert results[-1]['id'] == 2500
    
    def test_streaming_memory_efficiency(self):
        """Test that streaming is memory efficient"""
        mock_db_service = Mock()
        
        # Mock large chunks
        def generate_chunk(start, size):
            return [{'id': i, 'data': 'x' * 100} for i in range(start, start + size)]
        
        chunks = [
            generate_chunk(1, 1000),
            generate_chunk(1001, 1000),
            generate_chunk(2001, 1000),
            []
        ]
        
        mock_db_service.execute_query.side_effect = chunks
        
        streamer = QueryStreamer(mock_db_service, chunk_size=1000)
        
        # Process results one by one (simulating memory-efficient processing)
        processed_count = 0
        for result in streamer.stream_results("SELECT * FROM asteroids", (), max_results=3000):
            processed_count += 1
            # Simulate processing without storing all results
            assert 'id' in result
            assert 'data' in result
        
        assert processed_count == 3000
    
    def test_streaming_with_limit(self):
        """Test streaming with result limits"""
        mock_db_service = Mock()
        
        # Mock more data than limit
        chunk1 = [{'id': i} for i in range(1, 1001)]
        chunk2 = [{'id': i} for i in range(1001, 2001)]
        
        mock_db_service.execute_query.side_effect = [chunk1, chunk2]
        
        streamer = QueryStreamer(mock_db_service, chunk_size=1000)
        
        results = list(streamer.stream_results("SELECT * FROM asteroids", (), max_results=1500))
        
        assert len(results) == 1500
        assert results[0]['id'] == 1
        assert results[-1]['id'] == 1500


if __name__ == "__main__":
    pytest.main([__file__, "-v"])