import sqlite3

import pytest

from app.services.database_service import DatabaseManager


def make_database(path):
    connection = sqlite3.connect(path)
    connection.executescript(
        """
        CREATE TABLE asteroids (id INTEGER PRIMARY KEY, proper_name TEXT);
        INSERT INTO asteroids(id, proper_name) VALUES (1, 'Ceres'), (2, 'Pallas');
        """
    )
    connection.close()


def test_sqlite_manager_executes_existing_mysql_style_queries(tmp_path):
    database_path = tmp_path / 'spectral.sqlite3'
    make_database(database_path)
    manager = DatabaseManager({'engine': 'sqlite', 'path': str(database_path)})

    result = manager.execute_query(
        'SELECT id, proper_name FROM asteroids WHERE id = %s',
        (1,),
    )

    assert result.to_dict('records') == [{'id': 1, 'proper_name': 'Ceres'}]
    assert manager.test_connection() is True


def test_sqlite_manager_opens_snapshot_read_only(tmp_path):
    database_path = tmp_path / 'spectral.sqlite3'
    make_database(database_path)
    manager = DatabaseManager({'engine': 'sqlite', 'path': str(database_path)})

    with pytest.raises(sqlite3.OperationalError, match='readonly|read-only'):
        manager.execute_query("INSERT INTO asteroids(id, proper_name) VALUES (%s, %s)", (3, 'Juno'))


def test_sqlite_manager_rejects_missing_snapshot(tmp_path):
    manager = DatabaseManager({'engine': 'sqlite', 'path': str(tmp_path / 'missing.sqlite3')})

    assert manager.test_connection() is False
