# Desktop release guide

## Outputs

The release workflow builds native artifacts on each target operating system,
including both current macOS architectures. Cross-compilation is intentionally avoided because the Python sidecar
contains native NumPy, pandas, h5py, and Astropy modules.

| Platform | GitHub runner | Artifacts |
| --- | --- | --- |
| macOS Apple Silicon | `macos-15` | arm64 `.dmg`, `.zip` |
| macOS Intel | `macos-15-intel` | x64 `.dmg`, `.zip` |
| Windows x64 | `windows-2025` | NSIS `.exe` |
| Linux x64 | `ubuntu-24.04` | `.AppImage`, `.deb` |

## Local build

Install Node.js 22 and Python 3.11, then run:

```bash
(cd frontend && npm ci --ignore-scripts)
(cd desktop && npm ci)
python -m pip install -r backend/requirements-desktop.txt
npm run desktop:dist:mac
```

Replace the final script with `desktop:dist:win` or `desktop:dist:linux` on the
corresponding operating system. Artifacts are written to `desktop/release/`.

## GitHub release

1. Run the `Desktop installers` workflow manually to validate all four build jobs.
2. Update both root and desktop package versions to the intended release.
3. Push an annotated tag such as `v1.0.0`.
4. The workflow builds every installer and creates the GitHub release only after
   all platform builds pass. The release also includes `SHA256SUMS.txt`.

## Runtime configuration

On first launch, the application asks for MySQL host, port, database, user, and
password. Deployment automation may provide these environment variables instead:

```text
SPECTRAL_DB_HOST
SPECTRAL_DB_PORT
SPECTRAL_DB_NAME
SPECTRAL_DB_USER
SPECTRAL_DB_PASSWORD
```

The database must already contain the tables used by the API, including
`asteroids`, `observations`, and `meteorites`.

`127.0.0.1` means the computer on which the desktop application is running. A
Windows installation on another computer must use a reachable LAN/VPN hostname
or IP address for MySQL, and the server firewall and MySQL grants must allow that
client. Use a dedicated least-privilege database account rather than remote root.

## Signing boundary

The checked-in workflow produces installable but unsigned artifacts. Public
distribution should add:

- Apple Developer ID signing and notarization for macOS;
- an Authenticode code-signing certificate for Windows;
- release checksums and, where appropriate, GPG signing for Linux.

Do not place certificates, passwords, or signing keys in the repository. Use
GitHub Actions secrets and the signing inputs supported by `electron-builder`.
