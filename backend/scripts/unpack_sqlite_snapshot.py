#!/usr/bin/env python3
"""Decompress and validate the versioned desktop database snapshot."""

import argparse
import hashlib
import sqlite3
from pathlib import Path

import zstandard


REQUIRED_TABLES = {'asteroids', 'observations', 'meteorites', 'spectral_snapshot_metadata'}


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--sha256', required=True)
    return parser.parse_args()


def sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def main():
    args = parse_args()
    actual_checksum = sha256(args.input)
    if actual_checksum.lower() != args.sha256.lower():
        raise SystemExit(
            f'Snapshot checksum mismatch: expected {args.sha256}, got {actual_checksum}'
        )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_suffix(f'{args.output.suffix}.tmp')
    temporary.unlink(missing_ok=True)
    with args.input.open('rb') as source, temporary.open('wb') as destination:
        zstandard.ZstdDecompressor().copy_stream(source, destination)

    connection = sqlite3.connect(f'file:{temporary.resolve()}?mode=ro', uri=True)
    try:
        integrity = connection.execute('PRAGMA integrity_check').fetchone()[0]
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            )
        }
        missing = REQUIRED_TABLES - tables
        if integrity != 'ok' or missing:
            raise RuntimeError(
                f'Invalid snapshot: integrity={integrity}, missing_tables={sorted(missing)}'
            )
    finally:
        connection.close()

    temporary.replace(args.output)
    print(f'Prepared {args.output} ({args.output.stat().st_size / 1024 / 1024:.1f} MiB)')


if __name__ == '__main__':
    main()
