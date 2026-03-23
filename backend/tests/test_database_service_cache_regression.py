"""
Regression tests for query-cache behavior in database service.
"""
from unittest.mock import Mock, patch

import pandas as pd

from app.services.database_service import FlaskDatabaseService


def test_execute_query_discards_placeholder_cached_result_and_refetches():
    service = FlaskDatabaseService()
    service.db_manager = Mock()

    query = "SELECT COUNT(*) as total FROM asteroids a"
    placeholder_df = pd.DataFrame([{"total": "total"}])
    real_df = pd.DataFrame([{"total": 123}])

    mock_cache = Mock()
    mock_cache.get_query_result.return_value = placeholder_df
    service.db_manager.execute_query.return_value = real_df

    with patch("app.services.database_service.get_query_cache", return_value=mock_cache):
        result = service.execute_query(query, use_cache=True)

    assert int(result.iloc[0]["total"]) == 123
    service.db_manager.execute_query.assert_called_once_with(query, None)
    mock_cache.invalidate_query.assert_called_once_with(query, None)

