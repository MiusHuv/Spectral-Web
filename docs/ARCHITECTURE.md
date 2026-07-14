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
| Data access | PyMySQL, pandas, NumPy | MySQL queries and spectral parsing/normalization |
| Desktop shell | Electron | Installer, native window, local HTTP proxy, settings, and lifecycle |
| Desktop sidecar | PyInstaller, Waitress | Bundled cross-platform Flask runtime |

The desktop package contains the compiled web UI and the Python API sidecar.
Catalogue data is deliberately not embedded: the application connects to an
existing MySQL database with the schema expected by the backend.

## Desktop startup

1. Electron reads database settings from the operating-system application data
   directory. Passwords are encrypted with Electron `safeStorage` when the OS
   credential service is available.
2. Electron chooses private loopback ports and starts the bundled Python API.
3. A loopback-only static server serves the compiled React files and proxies
   `/api` to the sidecar. This preserves the web application's relative API URLs.
4. The main window opens only after `/health` succeeds. Startup failures reopen
   database settings and write diagnostics to `backend.log`.

No service is exposed on a LAN interface by the desktop package.

## Important boundaries

- MySQL data and schema migrations are not present in this repository.
- Installers are unsigned by default. Signing and notarization require the
  publisher's Apple and Microsoft credentials.
- The web/Docker deployment remains available and is independent of Electron.
- The desktop shell does not grant Node.js access to the React renderer.
