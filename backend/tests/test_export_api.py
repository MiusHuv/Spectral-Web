"""
Unit tests for export API endpoints.
"""
from unittest.mock import Mock, patch

import pytest
from flask import Flask

from app.api.export import _rate_limit_storage, export_bp
from app.models.export_models import ExportResult


@pytest.fixture
def app():
    """Create test Flask application."""
    app = Flask(__name__)
    app.config["TESTING"] = True
    app.register_blueprint(export_bp, url_prefix="/api")
    return app


@pytest.fixture
def client(app):
    """Create test client."""
    return app.test_client()


@pytest.fixture(autouse=True)
def clear_rate_limit_storage():
    """Avoid cross-test pollution from in-memory rate limiter."""
    _rate_limit_storage.clear()


@pytest.fixture
def valid_request():
    """Return a valid export request payload."""
    return {
        "item_ids": ["ast_1"],
        "format": "csv",
        "include_fields": {
            "basic_info": True,
            "classification": True,
            "orbital_params": True,
            "physical_props": True,
            "spectral_data": True,
        },
        "spectral_options": {
            "wavelength_range": [0.45, 2.45],
            "resolution": "original",
            "include_uncertainty": True,
            "include_metadata": True,
        },
    }


@pytest.fixture
def sample_export_result():
    """Create a realistic export result."""
    content = b"id,proper_name\n1,Ceres\n"
    return ExportResult(
        content=content,
        filename="asteroids_export.csv",
        mime_type="text/csv",
        size_bytes=len(content),
        item_count=1,
        format="csv",
    )


@pytest.fixture
def mock_export_service(sample_export_result):
    """Create a mocked export service."""
    service = Mock()
    service.export_data.return_value = sample_export_result
    service.preview_export.return_value = {
        "format": "csv",
        "data_type": "asteroids",
        "total_items": 1,
        "structure": {
            "metadata_columns": ["id", "proper_name"],
            "metadata_column_count": 2,
            "total_row_count": 1,
            "sample_row_count": 1,
        },
        "sample_data": [{"id": "ast_1", "proper_name": "Ceres"}],
        "included_fields": {
            "basic_info": True,
            "classification": True,
            "orbital_params": True,
            "physical_props": True,
            "spectral_data": True,
        },
        "estimated_size_bytes": 2048,
        "estimated_size_human": "2.00 KB",
        "export_type": "single",
    }
    service.estimate_size.return_value = 2048
    return service


class TestExportEndpoints:
    """Test cases for export endpoints."""

    def test_export_asteroids_success(self, client, mock_export_service, valid_request):
        """Asteroid export should return a downloadable file."""
        with patch("app.api.export.get_export_service", return_value=mock_export_service):
            response = client.post("/api/export/asteroids", json=valid_request)

        assert response.status_code == 200
        assert response.data == b"id,proper_name\n1,Ceres\n"
        assert "text/csv" in response.headers["Content-Type"]
        assert "asteroids_export.csv" in response.headers["Content-Disposition"]

        config = mock_export_service.export_data.call_args.args[0]
        assert config.data_type == "asteroids"
        assert config.item_ids == ["ast_1"]
        assert config.format == "csv"

    def test_export_meteorites_success(self, client, mock_export_service, valid_request):
        """Meteorite export should force the meteorites data type."""
        with patch("app.api.export.get_export_service", return_value=mock_export_service):
            response = client.post("/api/export/meteorites", json=valid_request)

        assert response.status_code == 200
        config = mock_export_service.export_data.call_args.args[0]
        assert config.data_type == "meteorites"

    def test_preview_export_success(self, client, mock_export_service, valid_request):
        """Preview endpoint should return JSON structure details."""
        with patch("app.api.export.get_export_service", return_value=mock_export_service):
            response = client.post(
                "/api/export/preview",
                json={**valid_request, "data_type": "asteroids"},
            )

        assert response.status_code == 200
        payload = response.get_json()
        assert payload["format"] == "csv"
        assert payload["total_items"] == 1
        assert payload["structure"]["metadata_column_count"] == 2

    def test_estimate_export_size_success(self, client, mock_export_service, valid_request):
        """Size estimation should expose bytes, human format, and spectral flag."""
        with patch("app.api.export.get_export_service", return_value=mock_export_service):
            response = client.post(
                "/api/export/estimate-size",
                json={**valid_request, "data_type": "asteroids"},
            )

        assert response.status_code == 200
        payload = response.get_json()
        assert payload["estimated_size_bytes"] == 2048
        assert payload["estimated_size_human"] == "2.00 KB"
        assert payload["includes_spectral_data"] is True
        assert payload["format"] == "csv"

    def test_missing_item_ids_returns_validation_error(self, client):
        """Requests without item_ids should be rejected."""
        response = client.post("/api/export/asteroids", json={"format": "csv"})

        assert response.status_code == 400
        payload = response.get_json()
        assert payload["message"] == "item_ids is required"

    def test_invalid_format_returns_validation_error(self, client, valid_request):
        """Unsupported export formats should be rejected early."""
        response = client.post(
            "/api/export/asteroids",
            json={**valid_request, "format": "xml"},
        )

        assert response.status_code == 400
        payload = response.get_json()
        assert "Unsupported format" in payload["message"]

    def test_no_fields_selected_returns_validation_error(self, client, valid_request):
        """At least one field group must stay enabled."""
        response = client.post(
            "/api/export/asteroids",
            json={
                **valid_request,
                "include_fields": {
                    "basic_info": False,
                    "classification": False,
                    "orbital_params": False,
                    "physical_props": False,
                    "spectral_data": False,
                },
            },
        )

        assert response.status_code == 400
        payload = response.get_json()
        assert "At least one field category must be selected" in payload["message"]

    def test_preview_invalid_data_type_returns_validation_error(self, client, valid_request):
        """Invalid data types should surface a validation error."""
        response = client.post(
            "/api/export/preview",
            json={**valid_request, "data_type": "comets"},
        )

        assert response.status_code == 400
        payload = response.get_json()
        assert "Invalid data_type" in payload["message"]

    def test_export_service_failure_returns_server_error(
        self, client, mock_export_service, valid_request
    ):
        """Unexpected export failures should return a 500 response."""
        mock_export_service.export_data.side_effect = RuntimeError("boom")

        with patch("app.api.export.get_export_service", return_value=mock_export_service):
            response = client.post("/api/export/asteroids", json=valid_request)

        assert response.status_code == 500
        payload = response.get_json()
        assert payload["error"] == "Internal Server Error"
        assert "Failed to export asteroid data" in payload["message"]
