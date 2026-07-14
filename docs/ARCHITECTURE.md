# Spectral Web architecture

## Product surface

Spectral Web is a catalogue browser and plotting application for asteroid and
meteorite spectra. Its user-facing workflows cover:

- browsing Bus-DeMeo and Tholen taxonomy groups;
- searching asteroid and meteorite records;
- inspecting orbital, physical, and observation metadata;
- plotting individual spectra and comparing selected spectra;
- exporting selected data as CSV, JSON, HDF5, or FITS.

## Runtime layers

| Layer | Implementation | Responsibility |
| --- | --- | --- |
| Web UI | React, TypeScript, Vite, D3 | Navigation, tables, charts, selection, and export UI |
| API | Flask, Flask-RESTful | Validation, pagination, serialization, caching, and exports |
| Data access | sqlite3/PyMySQL, pandas, NumPy | Embedded or server queries and spectral parsing/normalization |
| Desktop shell | Electron | Installer, native window, local HTTP proxy, settings, and lifecycle |
| Desktop sidecar | PyInstaller, Waitress | Bundled cross-platform Flask runtime |

The desktop package contains the compiled web UI, the Python API sidecar, and a
versioned read-only SQLite catalogue snapshot. MySQL remains available for web
deployment and as an explicit advanced desktop data source.

## Desktop startup

1. Electron locates the SQLite snapshot in the installed application resources.
2. Electron chooses private loopback ports and starts the bundled Python API.
3. A loopback-only static server serves the compiled React files and proxies
   `/api` to the sidecar. This preserves the web application's relative API URLs.
4. The main window opens only after `/health` succeeds. Startup failures write
   diagnostics to `backend.log`; external MySQL failures reopen its settings.

No service is exposed on a LAN interface by the desktop package.

## Important boundaries

- The generated SQLite file is distributed as a versioned release asset rather
  than committed to Git. Its checksum is pinned by the release workflow.
- Installers are unsigned by default. Signing and notarization require the
  publisher's Apple and Microsoft credentials.
- The web/Docker deployment remains available and is independent of Electron.
- The desktop shell does not grant Node.js access to the React renderer.
