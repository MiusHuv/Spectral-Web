# Spectral Web

Spectral Web is a full-stack application for exploring asteroid and meteorite
catalogues, inspecting spectral observations, comparing reflectance curves, and
exporting selected scientific data. The repository supports both browser-based
deployment and installable desktop applications for macOS, Windows, and Linux.

## What is included

- React 18, TypeScript, Vite, and D3 frontend
- Flask REST API with pagination, validation, caching, and data export
- SQLite/MySQL asteroid, observation, taxonomy, and meteorite data access
- CSV, JSON, HDF5, and FITS conversion paths
- Electron desktop shell with a bundled PyInstaller backend sidecar
- Unit, integration, end-to-end, performance, and visual test suites

Desktop installers include a read-only SQLite catalogue snapshot and run without
MySQL, Docker, network access, database credentials, or administrator-managed
services. The browser deployment continues to use MySQL for shared data.

## Repository map

```text
Spectral-Web/
├── frontend/                 React/Vite user interface
├── backend/                  Flask API and scientific export services
├── desktop/                  Electron shell and installer configuration
├── docs/                     Architecture and release documentation
├── .github/workflows/        Test and three-platform release automation
├── docker-compose.yml        Browser deployment stack
└── package.json              Root development and release commands
```

See [architecture](docs/ARCHITECTURE.md) for component responsibilities and
[desktop release guide](docs/DESKTOP_RELEASE.md) for installer details.

## Web development

Prerequisites: Node.js 22, Python 3.11, and MySQL 8.

```bash
npm ci
(cd frontend && npm ci)
python -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements-dev.txt
```

Set the database environment variables before starting the services:

```bash
export DB_HOST=127.0.0.1
export DB_PORT=3306
export DB_NAME=asteroid_spectral_db
export DB_USER=asteroid_user
export DB_PASSWORD='replace-me'
npm run dev
```

The frontend runs at `http://localhost:3000` and proxies API requests to the
backend at `http://localhost:5000`.

## Testing

```bash
npm run test:frontend
npm run test:backend
```

Additional frontend scripts cover Cypress end-to-end tests, performance tests,
and visual regression tests. The GitHub Actions test workflow supplies a MySQL
service for backend and integration jobs.

## Production web build

```bash
npm run build
docker compose up --build -d
```

Provide `DB_PASSWORD` and the remaining database variables through a private
environment file or deployment secret store.

## Desktop installers

Generate or download `desktop/data/spectral.sqlite3`, then build on the target
operating system after installing desktop requirements:

```bash
(cd desktop && npm ci)
python -m pip install -r backend/requirements-desktop.txt
npm run desktop:dist:mac
```

Use `desktop:dist:win` on Windows and `desktop:dist:linux` on Linux. The
`Desktop installers` GitHub Actions workflow builds all three native packages;
tags matching `v*` also publish a GitHub release.

The desktop app uses the bundled SQLite snapshot automatically. An advanced menu
option can connect to an external MySQL service when a shared live catalogue is
required; credentials are stored in the platform credential service when
available. macOS and Windows artifacts remain unsigned until publisher signing
credentials are configured.

## License

The project declares the MIT license in its package metadata.
