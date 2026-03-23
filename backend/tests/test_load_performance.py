"""
Load testing for backend API endpoints using in-process Flask test clients.
This avoids external localhost dependencies while keeping concurrency checks.
"""

import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from statistics import mean, median
from typing import Any, Dict, List, Tuple
from unittest.mock import Mock

import pytest

from app import create_app
from app.models.export_models import ExportResult


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
            "total_requests": len(self.response_times),
            "success_count": self.success_count,
            "error_count": self.error_count,
            "success_rate": self.success_count / len(self.response_times) * 100,
            "avg_response_time": mean(self.response_times),
            "median_response_time": median(self.response_times),
            "min_response_time": min(self.response_times),
            "max_response_time": max(self.response_times),
            "errors": self.errors[:10],
        }


def _make_request(app, path: str, method: str = "GET", data: Dict = None) -> Tuple[float, bool, str]:
    start_time = time.time()
    try:
        with app.test_client() as client:
            if method == "GET":
                response = client.get(path)
            elif method == "POST":
                response = client.post(path, json=data)
            else:
                raise ValueError(f"Unsupported method: {method}")
        response_time = time.time() - start_time
        success = response.status_code == 200
        error = None if success else f"HTTP {response.status_code}"
        return response_time, success, error
    except Exception as exc:  # pragma: no cover - defensive path
        response_time = time.time() - start_time
        return response_time, False, str(exc)


@pytest.fixture
def app(monkeypatch):
    app = create_app("testing")

    mock_data_access = Mock()
    mock_data_access.get_classification_systems.return_value = {
        "systems": [
            {"name": "bus_demeo", "display_name": "Bus-DeMeo", "classes": ["C", "S"]},
            {"name": "tholen", "display_name": "Tholen", "classes": ["C", "S"]},
        ]
    }

    def _classifications(system, limit=None, offset=0, per_class_limit=None, stream_results=False):
        requested = min(limit or 100, 100)
        asteroids = [
            {
                "id": i + 1 + offset,
                "display_name": f"Asteroid {i + 1 + offset}",
                "identifiers": {
                    "official_number": i + 1 + offset,
                    "proper_name": f"Asteroid {i + 1 + offset}",
                    "provisional_designation": None,
                },
                "has_spectral_data": True,
            }
            for i in range(requested)
        ]
        return {
            "classes": [{"name": "C", "count": len(asteroids), "total_in_class": 5000, "asteroids": asteroids}],
            "pagination": {
                "total_available": 5000,
                "total_returned": len(asteroids),
                "offset": offset,
                "limit": requested,
                "has_more": True,
                "next_offset": offset + len(asteroids),
            },
            "class_counts": {"C": 5000},
            "memory_optimized": stream_results,
        }

    mock_data_access.get_asteroids_by_classification.side_effect = _classifications
    mock_data_access.get_asteroids_spectra_batch.side_effect = lambda ids: [
        {
            "asteroid_id": aid,
            "wavelengths": [0.45, 1.0, 2.45],
            "reflectances": [0.9, 1.0, 1.1],
            "has_data": True,
            "metadata": {},
        }
        for aid in ids
    ]
    mock_data_access.get_asteroids_batch.side_effect = lambda ids: [
        {
            "id": aid,
            "identifiers": {"official_number": aid, "proper_name": f"Asteroid {aid}", "provisional_designation": None},
            "classifications": {"bus_demeo_class": "C", "tholen_class": None, "orbital_class": None},
            "orbital_elements": {},
            "physical_properties": {},
        }
        for aid in ids
    ]

    mock_export_service = Mock()
    mock_export_service.export_data.return_value = ExportResult(
        content=b"id\n1\n",
        filename="asteroids_export.csv",
        mime_type="text/csv",
        size_bytes=5,
        item_count=1,
        format="csv",
    )

    # Avoid test flakiness from in-memory export rate limiting during concurrent runs.
    monkeypatch.setattr("app.api.export.RATE_LIMIT_REQUESTS", 1000)
    monkeypatch.setattr("app.api.export.RATE_LIMIT_WINDOW", 60)
    from app.api.export import _rate_limit_storage

    _rate_limit_storage.clear()

    monkeypatch.setattr("app.api.classifications.get_data_access", lambda: mock_data_access)
    monkeypatch.setattr("app.api.spectral.get_data_access", lambda: mock_data_access)
    monkeypatch.setattr("app.api.asteroids.get_data_access", lambda: mock_data_access)
    monkeypatch.setattr("app.api.export.get_export_service", lambda: mock_export_service)

    return app


class TestLoadPerformance:
    """Concurrent load checks against in-process API handlers."""

    def test_classifications_endpoint_load(self, app):
        results = LoadTestResults()
        path = "/api/classifications"

        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(_make_request, app, path) for _ in range(50)]
            for future in as_completed(futures):
                response_time, success, error = future.result()
                results.add_result(response_time, success, error)

        stats = results.get_stats()
        assert stats["success_rate"] >= 99
        assert stats["avg_response_time"] < 1.0
        assert stats["max_response_time"] < 3.0

    def test_asteroids_by_classification_load(self, app):
        results = LoadTestResults()
        path = "/api/classifications/bus_demeo/asteroids?limit=100"

        with ThreadPoolExecutor(max_workers=8) as executor:
            futures = [executor.submit(_make_request, app, path) for _ in range(30)]
            for future in as_completed(futures):
                response_time, success, error = future.result()
                results.add_result(response_time, success, error)

        stats = results.get_stats()
        assert stats["success_rate"] >= 99
        assert stats["avg_response_time"] < 1.5

    def test_spectral_data_batch_load(self, app):
        results = LoadTestResults()
        path = "/api/spectra/batch"
        test_data = {"asteroid_ids": [1, 2, 3, 4, 5]}

        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(_make_request, app, path, "POST", test_data) for _ in range(20)]
            for future in as_completed(futures):
                response_time, success, error = future.result()
                results.add_result(response_time, success, error)

        stats = results.get_stats()
        assert stats["success_rate"] >= 99
        assert stats["avg_response_time"] < 2.0

    def test_asteroid_details_batch_load(self, app):
        results = LoadTestResults()
        path = "/api/asteroids/batch"
        test_data = {"asteroid_ids": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}

        with ThreadPoolExecutor(max_workers=6) as executor:
            futures = [executor.submit(_make_request, app, path, "POST", test_data) for _ in range(25)]
            for future in as_completed(futures):
                response_time, success, error = future.result()
                results.add_result(response_time, success, error)

        stats = results.get_stats()
        assert stats["success_rate"] >= 99
        assert stats["avg_response_time"] < 2.0

    def test_export_endpoint_load(self, app):
        results = LoadTestResults()
        path = "/api/export/asteroids"
        test_data = {"item_ids": ["ast_1", "ast_2", "ast_3"], "format": "json"}

        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = [executor.submit(_make_request, app, path, "POST", test_data) for _ in range(15)]
            for future in as_completed(futures):
                response_time, success, error = future.result()
                results.add_result(response_time, success, error)

        stats = results.get_stats()
        assert stats["success_rate"] >= 99
        assert stats["avg_response_time"] < 3.0

    def test_sustained_load(self, app):
        results = LoadTestResults()
        path = "/api/classifications"
        end_time = time.time() + 5  # keep test runtime practical

        def make_sustained_requests():
            local_results = LoadTestResults()
            while time.time() < end_time:
                response_time, success, error = _make_request(app, path)
                local_results.add_result(response_time, success, error)
                time.sleep(0.2)
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
        assert stats["success_rate"] >= 99
        assert stats["avg_response_time"] < 1.5

    def test_database_connection_pool_stress(self, app):
        results = LoadTestResults()
        paths = [
            "/api/classifications",
            "/api/classifications/bus_demeo/asteroids?limit=100",
            "/api/classifications/tholen/asteroids?limit=100",
        ]

        def make_mixed_requests():
            local_results = LoadTestResults()
            for path in paths * 10:
                response_time, success, error = _make_request(app, path)
                local_results.add_result(response_time, success, error)
            return local_results

        with ThreadPoolExecutor(max_workers=8) as executor:
            futures = [executor.submit(make_mixed_requests) for _ in range(8)]
            for future in as_completed(futures):
                local_results = future.result()
                results.response_times.extend(local_results.response_times)
                results.success_count += local_results.success_count
                results.error_count += local_results.error_count
                results.errors.extend(local_results.errors)

        stats = results.get_stats()
        assert stats["success_rate"] >= 99
        assert stats["avg_response_time"] < 2.0


class TestMemoryAndResourceUsage:
    def test_memory_usage_under_load(self, app):
        import os
        import psutil

        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss / 1024 / 1024
        path = "/api/classifications/bus_demeo/asteroids?limit=100"

        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(_make_request, app, path) for _ in range(100)]
            for future in as_completed(futures):
                future.result()

        final_memory = process.memory_info().rss / 1024 / 1024
        memory_increase = final_memory - initial_memory
        assert memory_increase < 100, f"Memory usage increased too much: {memory_increase}MB"
