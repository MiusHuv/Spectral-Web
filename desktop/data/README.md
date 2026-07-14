# Embedded database snapshot

`spectral.sqlite3` is generated from the maintained MySQL catalogue and is not
stored in Git. Build it locally with:

```bash
MYSQL_PASSWORD=... python backend/scripts/export_mysql_to_sqlite.py \
  --output desktop/data/spectral.sqlite3
```

Release builds download the versioned snapshot configured by the desktop
workflow before invoking `electron-builder`.
