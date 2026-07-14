#!/usr/bin/env python3
"""Create the read-only desktop SQLite snapshot from the production MySQL data."""

import argparse
import datetime as dt
import decimal
import json
import os
import sqlite3
import sys
from pathlib import Path

import pymysql


SCHEMA = """
CREATE TABLE asteroids (
    id INTEGER PRIMARY KEY,
    official_number INTEGER UNIQUE,
    provisional_designation TEXT UNIQUE,
    proper_name TEXT,
    tholen_class TEXT,
    sdss_class TEXT,
    H REAL, G REAL, M1 REAL, K1 REAL, M2 REAL, K2 REAL, PC REAL,
    diameter REAL,
    extent TEXT,
    GM REAL,
    density REAL,
    rot_per REAL,
    pole TEXT,
    albedo REAL,
    BV REAL, UB REAL, IR REAL,
    orbital_class TEXT,
    neo_flag INTEGER,
    pha_flag INTEGER,
    orbit_class_code TEXT,
    orbit_class_name TEXT,
    semi_major_axis REAL,
    eccentricity REAL,
    inclination REAL,
    perihelion_distance REAL,
    aphelion_distance REAL,
    orbital_period REAL,
    earth_moid REAL,
    jupiter_tisserand REAL,
    orbit_epoch REAL,
    orbit_solution_id TEXT,
    orbital_data_updated TEXT,
    bus_demeo_class TEXT,
    CHECK (official_number IS NOT NULL OR provisional_designation IS NOT NULL)
);

CREATE TABLE observations (
    id INTEGER PRIMARY KEY,
    asteroid_id INTEGER NOT NULL REFERENCES asteroids(id) ON DELETE CASCADE,
    start_time TEXT,
    stop_time TEXT,
    band TEXT,
    mission TEXT,
    data_source TEXT NOT NULL UNIQUE,
    reference_text TEXT,
    spectral_data TEXT,
    instrument TEXT,
    telescope TEXT,
    observatory TEXT
);

CREATE TABLE meteorites (
    id INTEGER PRIMARY KEY,
    file_name TEXT UNIQUE,
    specimen_id TEXT NOT NULL,
    specimen_name TEXT,
    specimen_type TEXT,
    modified TEXT,
    main_label TEXT,
    sub_label TEXT,
    sub_sub_label TEXT,
    spectral_data TEXT
);

CREATE TABLE spectral_snapshot_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""

INDEXES = """
CREATE INDEX idx_asteroids_orbital_class ON asteroids(orbital_class);
CREATE INDEX idx_asteroids_bus_demeo_class ON asteroids(bus_demeo_class);
CREATE INDEX idx_asteroids_tholen_class ON asteroids(tholen_class);
CREATE INDEX idx_asteroids_bus_ordering ON asteroids(bus_demeo_class, official_number, id);
CREATE INDEX idx_asteroids_tholen_ordering ON asteroids(tholen_class, official_number, id);
CREATE INDEX idx_asteroids_proper_name ON asteroids(proper_name);
CREATE INDEX idx_asteroids_provisional ON asteroids(provisional_designation);
CREATE INDEX idx_observations_asteroid ON observations(asteroid_id);
CREATE INDEX idx_observations_asteroid_band ON observations(asteroid_id, band);
CREATE INDEX idx_meteorites_labels ON meteorites(main_label, sub_label);
"""

TABLES = ('asteroids', 'observations', 'meteorites')


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--host', default=os.getenv('MYSQL_HOST', '127.0.0.1'))
    parser.add_argument('--port', type=int, default=int(os.getenv('MYSQL_PORT', '3306')))
    parser.add_argument('--database', default=os.getenv('MYSQL_DATABASE', 'asteroid_spectral_db'))
    parser.add_argument('--user', default=os.getenv('MYSQL_USER', 'root'))
    parser.add_argument('--password', default=os.getenv('MYSQL_PASSWORD', ''))
    parser.add_argument('--chunk-size', type=int, default=1000)
    return parser.parse_args()


def normalize(value):
    if isinstance(value, decimal.Decimal):
        return float(value)
    if isinstance(value, (dt.datetime, dt.date, dt.time)):
        return value.isoformat(sep=' ') if isinstance(value, dt.datetime) else value.isoformat()
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, separators=(',', ':'))
    return value


def copy_table(mysql_connection, sqlite_connection, table, chunk_size):
    with mysql_connection.cursor() as cursor:
        cursor.execute(f"SELECT * FROM `{table}`")
        columns = [item[0] for item in cursor.description]
        placeholders = ','.join('?' for _ in columns)
        quoted_columns = ','.join(f'"{column}"' for column in columns)
        insert_sql = f'INSERT INTO "{table}" ({quoted_columns}) VALUES ({placeholders})'
        total = 0
        while True:
            rows = cursor.fetchmany(chunk_size)
            if not rows:
                break
            normalized = [tuple(normalize(value) for value in row) for row in rows]
            sqlite_connection.executemany(insert_sql, normalized)
            sqlite_connection.commit()
            total += len(rows)
            print(f'{table}: {total:,} rows', flush=True)
    return total


def main():
    args = parse_args()
    if not args.password:
        raise SystemExit('MYSQL_PASSWORD or --password is required')

    output = args.output.expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(f'{output.suffix}.tmp')
    temporary.unlink(missing_ok=True)

    mysql_connection = pymysql.connect(
        host=args.host,
        port=args.port,
        user=args.user,
        password=args.password,
        database=args.database,
        charset='utf8mb4',
        cursorclass=pymysql.cursors.SSCursor,
        read_timeout=600,
    )
    sqlite_connection = sqlite3.connect(temporary)
    try:
        sqlite_connection.execute('PRAGMA journal_mode = OFF')
        sqlite_connection.execute('PRAGMA synchronous = OFF')
        sqlite_connection.execute('PRAGMA temp_store = MEMORY')
        sqlite_connection.execute('PRAGMA foreign_keys = OFF')
        sqlite_connection.executescript(SCHEMA)

        counts = {}
        for table in TABLES:
            counts[table] = copy_table(
                mysql_connection, sqlite_connection, table, args.chunk_size
            )

        sqlite_connection.executescript(INDEXES)
        sqlite_connection.executemany(
            'INSERT INTO spectral_snapshot_metadata(key, value) VALUES (?, ?)',
            [
                ('schema_version', '1'),
                ('created_at_utc', dt.datetime.now(dt.timezone.utc).isoformat()),
                ('source_database', args.database),
                *[(f'row_count_{table}', str(count)) for table, count in counts.items()],
            ],
        )
        sqlite_connection.execute('PRAGMA user_version = 1')
        sqlite_connection.commit()
        sqlite_connection.execute('PRAGMA foreign_keys = ON')
        violations = sqlite_connection.execute('PRAGMA foreign_key_check').fetchall()
        integrity = sqlite_connection.execute('PRAGMA integrity_check').fetchone()[0]
        if violations or integrity != 'ok':
            raise RuntimeError(
                f'SQLite validation failed: integrity={integrity}, foreign_keys={violations[:5]}'
            )
        sqlite_connection.execute('VACUUM')
    except Exception:
        sqlite_connection.close()
        temporary.unlink(missing_ok=True)
        raise
    finally:
        mysql_connection.close()
        if sqlite_connection:
            sqlite_connection.close()

    temporary.replace(output)
    print(f'Created {output} ({output.stat().st_size / 1024 / 1024:.1f} MiB)')


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
