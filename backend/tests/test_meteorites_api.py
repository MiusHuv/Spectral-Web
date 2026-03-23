"""
Regression tests for /api/meteorites endpoints.
"""
import pandas as pd
from unittest.mock import Mock, patch

from app import create_app


def _empty_meteorites_dataframe() -> pd.DataFrame:
    return pd.DataFrame(
        columns=[
            'id',
            'specimen_id',
            'specimen_name',
            'specimen_type',
            'main_label',
            'sub_label',
            'sub_sub_label',
        ]
    )


def test_meteorites_list_handles_non_numeric_total_value():
    app = create_app('testing')
    client = app.test_client()

    mock_db = Mock()
    mock_db.execute_query.side_effect = [
        pd.DataFrame({'total': ['total']}),
        _empty_meteorites_dataframe(),
    ]

    with patch('app.api.meteorites.get_database_service', return_value=mock_db):
        response = client.get('/api/meteorites?page=1&page_size=50')

    assert response.status_code == 200
    payload = response.get_json()
    assert payload['pagination']['total'] == 0
    assert payload['meteorites'] == []


def test_meteorites_list_tolerates_invalid_page_parameter():
    app = create_app('testing')
    client = app.test_client()

    mock_db = Mock()
    mock_db.execute_query.side_effect = [
        pd.DataFrame({'total': [0]}),
        _empty_meteorites_dataframe(),
    ]

    with patch('app.api.meteorites.get_database_service', return_value=mock_db):
        response = client.get('/api/meteorites?page=total&page_size=50')

    assert response.status_code == 200
    payload = response.get_json()
    assert payload['pagination']['page'] == 1
