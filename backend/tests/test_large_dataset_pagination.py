#!/usr/bin/env python3
"""
Unit tests for classification pagination and streaming behavior.
These tests align with the current DataAccessLayer and QueryStreamer contracts.
"""

import queue
import threading
from unittest.mock import Mock, patch

import pandas as pd
import pytest

from app.services.data_access import DataAccessLayer
from app.services.database_service import FlaskDatabaseService
from app.utils.query_streaming import QueryStreamer


def _classification_count_df(entries):
    return pd.DataFrame(entries)


def _classification_rows_df(rows):
    return pd.DataFrame(rows)


def _execute_query_side_effect(count_df, data_df):
    def _execute(query, params=None, **kwargs):
        if "COUNT(*) as total_count" in query:
            return count_df
        return data_df

    return _execute


class TestLargeDatasetPagination:
    """Test pagination logic against the current DataAccessLayer interface."""

    @pytest.fixture
    def mock_db_service(self):
        return Mock(spec=FlaskDatabaseService)

    @pytest.fixture
    def data_access(self, mock_db_service):
        with patch("app.services.data_access.get_database_service", return_value=mock_db_service):
            yield DataAccessLayer()

    def test_pagination_with_small_dataset(self, data_access, mock_db_service):
        count_df = _classification_count_df([{"classification": "C", "total_count": 100}])
        data_df = _classification_rows_df(
            [
                {
                    "id": i,
                    "official_number": i,
                    "proper_name": f"Asteroid {i}",
                    "provisional_designation": None,
                    "classification": "C",
                    "has_spectral_data": 1,
                }
                for i in range(1, 51)
            ]
        )
        mock_db_service.execute_query.side_effect = _execute_query_side_effect(count_df, data_df)

        result = data_access.get_asteroids_by_classification("bus_demeo", limit=50, offset=0)

        assert "classes" in result
        assert "pagination" in result
        assert len(result["classes"]) > 0
        c_class = next((cls for cls in result["classes"] if cls["name"] == "C"), None)
        assert c_class is not None
        assert c_class["total_in_class"] == 100
        assert result["pagination"]["total_available"] == 100
        assert result["pagination"]["total_returned"] == 50

    def test_pagination_with_large_dataset(self, data_access, mock_db_service):
        count_df = _classification_count_df([{"classification": "C", "total_count": 5000}])
        data_df = _classification_rows_df(
            [
                {
                    "id": i,
                    "official_number": i,
                    "proper_name": f"Asteroid {i}",
                    "provisional_designation": None,
                    "classification": "C",
                    "has_spectral_data": 1,
                }
                for i in range(1, 1001)
            ]
        )
        mock_db_service.execute_query.side_effect = _execute_query_side_effect(count_df, data_df)

        result = data_access.get_asteroids_by_classification("bus_demeo", limit=1000, offset=0)
        pagination = result["pagination"]

        assert pagination["total_available"] == 5000
        assert pagination["total_returned"] == 1000
        assert pagination["has_more"] is True
        assert pagination["next_offset"] == 1000

    def test_unlimited_query_uses_available_total(self, data_access, mock_db_service):
        count_df = _classification_count_df([{"classification": "C", "total_count": 50000}])
        mock_db_service.execute_query.side_effect = _execute_query_side_effect(count_df, pd.DataFrame())

        with patch("app.services.data_access.QueryStreamer") as mock_streamer_cls:
            streamer_instance = Mock()
            streamer_instance.stream_classification_query.return_value = iter([])
            streamer_instance.aggregate_streamed_results.return_value = {
                "classes": [{"name": "C", "count": 200, "asteroids": []}],
                "total_returned": 200,
            }
            mock_streamer_cls.return_value = streamer_instance

            result = data_access.get_asteroids_by_classification("bus_demeo", limit=None)

        assert result["pagination"]["total_available"] == 50000
        assert result["pagination"]["limit"] == 50000
        assert result["pagination"]["total_returned"] == 200
        assert result["pagination"]["has_more"] is True
        assert result["memory_optimized"] is True

    def test_per_class_limit_functionality(self, data_access, mock_db_service):
        count_df = _classification_count_df(
            [{"classification": cls, "total_count": 200} for cls in ["C", "S", "X", "M", "P"]]
        )
        data_rows = []
        for idx, cls in enumerate(["C", "S", "X", "M", "P"]):
            for j in range(50):
                asteroid_id = idx * 1000 + j + 1
                data_rows.append(
                    {
                        "id": asteroid_id,
                        "official_number": asteroid_id,
                        "proper_name": f"Asteroid {asteroid_id}",
                        "provisional_designation": None,
                        "classification": cls,
                        "has_spectral_data": 0,
                    }
                )
        data_df = _classification_rows_df(data_rows)
        mock_db_service.execute_query.side_effect = _execute_query_side_effect(count_df, data_df)

        result = data_access.get_asteroids_by_classification("bus_demeo", limit=None, per_class_limit=50)

        assert len(result["classes"]) == 5
        for cls in result["classes"]:
            assert cls["count"] == 50
            assert cls["total_in_class"] == 200

    def test_streaming_query_path(self, data_access, mock_db_service):
        count_df = _classification_count_df([{"classification": "C", "total_count": 20000}])

        def _execute(query, params=None, **kwargs):
            if "COUNT(*) as total_count" in query:
                return count_df
            return pd.DataFrame()

        mock_db_service.execute_query.side_effect = _execute

        with patch("app.services.data_access.QueryStreamer") as mock_streamer_cls:
            streamer_instance = Mock()
            streamer_instance.stream_classification_query.return_value = iter([])
            streamer_instance.aggregate_streamed_results.return_value = {
                "classes": [{"name": "C", "count": 1000, "asteroids": []}],
                "total_returned": 1000,
            }
            mock_streamer_cls.return_value = streamer_instance

            result = data_access.get_asteroids_by_classification(
                "bus_demeo", limit=10000, stream_results=True
            )

            mock_streamer_cls.assert_called_once()
            streamer_instance.stream_classification_query.assert_called_once()
            streamer_instance.aggregate_streamed_results.assert_called_once()
            assert result["memory_optimized"] is True
            assert result["pagination"]["total_returned"] == 1000

    def test_pagination_edge_cases(self, data_access, mock_db_service):
        count_df = _classification_count_df([{"classification": "C", "total_count": 100}])
        data_df = _classification_rows_df([])
        mock_db_service.execute_query.side_effect = _execute_query_side_effect(count_df, data_df)

        result = data_access.get_asteroids_by_classification("bus_demeo", limit=50, offset=200)

        assert result["pagination"]["total_available"] == 100
        assert result["pagination"]["offset"] == 200
        assert result["pagination"]["has_more"] is False
        assert result["classes"] == []

    def test_cache_behavior_with_pagination(self, data_access, mock_db_service):
        count_df = _classification_count_df([{"classification": "C", "total_count": 100}])
        data_df = _classification_rows_df(
            [
                {
                    "id": i,
                    "official_number": i,
                    "proper_name": f"Asteroid {i}",
                    "provisional_designation": None,
                    "classification": "C",
                    "has_spectral_data": 1,
                }
                for i in range(1, 51)
            ]
        )
        mock_db_service.execute_query.side_effect = _execute_query_side_effect(count_df, data_df)

        result1 = data_access.get_asteroids_by_classification("bus_demeo", limit=50, offset=0)
        result2 = data_access.get_asteroids_by_classification("bus_demeo", limit=50, offset=0)

        assert result1["pagination"] == result2["pagination"]
        assert len(result1["classes"]) == len(result2["classes"])

    def test_memory_optimization_flags(self, data_access, mock_db_service):
        small_count_df = _classification_count_df([{"classification": "C", "total_count": 100}])
        small_data_df = _classification_rows_df(
            [
                {
                    "id": i,
                    "official_number": i,
                    "proper_name": f"Asteroid {i}",
                    "provisional_designation": None,
                    "classification": "C",
                    "has_spectral_data": 1,
                }
                for i in range(1, 101)
            ]
        )
        mock_db_service.execute_query.side_effect = _execute_query_side_effect(small_count_df, small_data_df)
        result_small = data_access.get_asteroids_by_classification("bus_demeo", limit=100)
        assert result_small["memory_optimized"] is False

        large_count_df = _classification_count_df([{"classification": "C", "total_count": 20000}])
        large_data_df = _classification_rows_df(
            [
                {
                    "id": i,
                    "official_number": i,
                    "proper_name": f"Asteroid {i}",
                    "provisional_designation": None,
                    "classification": "C",
                    "has_spectral_data": 1,
                }
                for i in range(1, 501)
            ]
        )
        mock_db_service.execute_query.side_effect = _execute_query_side_effect(large_count_df, large_data_df)
        result_large = data_access.get_asteroids_by_classification("bus_demeo", limit=10001)
        assert result_large["memory_optimized"] is True

    def test_concurrent_pagination_requests(self, data_access, mock_db_service):
        count_df = _classification_count_df([{"classification": "C", "total_count": 1000}])
        data_df = _classification_rows_df(
            [
                {
                    "id": i,
                    "official_number": i,
                    "proper_name": f"Asteroid {i}",
                    "provisional_designation": None,
                    "classification": "C",
                    "has_spectral_data": 1,
                }
                for i in range(1, 101)
            ]
        )
        mock_db_service.execute_query.side_effect = _execute_query_side_effect(count_df, data_df)

        results_queue = queue.Queue()

        def make_request(offset):
            try:
                result = data_access.get_asteroids_by_classification(
                    "bus_demeo", limit=100, offset=offset
                )
                results_queue.put(("success", offset, result))
            except Exception as exc:
                results_queue.put(("error", offset, str(exc)))

        threads = []
        for i in range(10):
            thread = threading.Thread(target=make_request, args=(i * 100,))
            threads.append(thread)
            thread.start()

        for thread in threads:
            thread.join()

        success_count = 0
        while not results_queue.empty():
            status, offset, result = results_queue.get()
            if status == "success":
                success_count += 1
                assert result["pagination"]["offset"] == offset

        assert success_count == 10


class TestQueryStreaming:
    """Test current QueryStreamer API (`stream_query` and `stream_classification_query`)."""

    def test_query_streamer_initialization(self):
        mock_db_service = Mock()
        streamer = QueryStreamer(mock_db_service)

        assert streamer.db_service == mock_db_service
        assert streamer.chunk_size == 1000

    def test_stream_query_large_result_set(self):
        mock_db_service = Mock()
        connection = Mock()
        cursor = Mock()
        cursor.description = [("id",)]
        cursor.fetchmany.side_effect = [
            [(i,) for i in range(1, 1001)],
            [(i,) for i in range(1001, 2001)],
            [(i,) for i in range(2001, 2501)],
            [],
        ]
        connection.cursor.return_value = cursor
        mock_db_service.get_connection.return_value = connection

        streamer = QueryStreamer(mock_db_service, chunk_size=1000)
        chunks = list(streamer.stream_query("SELECT id FROM asteroids"))

        total_rows = sum(len(chunk) for chunk in chunks)
        assert total_rows == 2500
        assert chunks[0].iloc[0]["id"] == 1
        assert chunks[-1].iloc[-1]["id"] == 2500

    def test_streaming_memory_efficiency(self):
        mock_db_service = Mock()
        connection = Mock()
        cursor = Mock()
        cursor.description = [("id",), ("data",)]
        cursor.fetchmany.side_effect = [
            [(i, "x" * 100) for i in range(1, 1001)],
            [(i, "x" * 100) for i in range(1001, 2001)],
            [(i, "x" * 100) for i in range(2001, 3001)],
            [],
        ]
        connection.cursor.return_value = cursor
        mock_db_service.get_connection.return_value = connection

        streamer = QueryStreamer(mock_db_service, chunk_size=1000)
        processed_count = 0
        for chunk in streamer.stream_query("SELECT id, data FROM asteroids"):
            processed_count += len(chunk)
            assert "id" in chunk.columns
            assert "data" in chunk.columns

        assert processed_count == 3000

    def test_stream_classification_query_uses_expected_sql(self):
        mock_db_service = Mock()
        streamer = QueryStreamer(mock_db_service, chunk_size=500)

        with patch.object(streamer, "stream_query", return_value=iter([pd.DataFrame()])) as mock_stream_query:
            _ = list(streamer.stream_classification_query("bus_demeo", limit=1500, offset=10))

            called_query = mock_stream_query.call_args.args[0]
            assert "bus_demeo_class" in called_query
            assert "LIMIT 1500" in called_query
            assert "OFFSET 10" in called_query


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
