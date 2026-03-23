"""
Regression tests for /api/v2/asteroids endpoints.
"""
import pandas as pd
from unittest.mock import Mock, patch

from app import create_app


def _empty_asteroids_dataframe() -> pd.DataFrame:
    return pd.DataFrame(
        columns=[
            'id',
            'official_number',
            'proper_name',
            'provisional_designation',
            'bus_demeo_class',
            'tholen_class',
            'orbital_class',
            'semi_major_axis',
            'eccentricity',
            'inclination',
            'diameter',
            'albedo',
            'observation_count',
        ]
    )


def test_asteroids_list_handles_non_numeric_total_value():
    app = create_app('testing')
    client = app.test_client()

    mock_db = Mock()
    # First call: count query, second call: paginated data query.
    mock_db.execute_query.side_effect = [
        pd.DataFrame({'total': ['total']}),
        _empty_asteroids_dataframe(),
    ]

    with patch('app.api.asteroids_real.get_database_service', return_value=mock_db):
        response = client.get('/api/v2/asteroids?page=1&page_size=50')

    assert response.status_code == 200
    payload = response.get_json()
    assert payload['pagination']['total'] == 0
    assert payload['asteroids'] == []


def test_asteroids_list_tolerates_invalid_page_parameter():
    app = create_app('testing')
    client = app.test_client()

    mock_db = Mock()
    mock_db.execute_query.side_effect = [
        pd.DataFrame({'total': [0]}),
        _empty_asteroids_dataframe(),
    ]

    with patch('app.api.asteroids_real.get_database_service', return_value=mock_db):
        response = client.get('/api/v2/asteroids?page=total&page_size=50')

    assert response.status_code == 200
    payload = response.get_json()
    assert payload['pagination']['page'] == 1
