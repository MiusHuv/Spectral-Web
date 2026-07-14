# -*- mode: python ; coding: utf-8 -*-
from pathlib import Path

backend_dir = Path(SPECPATH)

a = Analysis(
    [str(backend_dir / 'desktop_entry.py')],
    pathex=[str(backend_dir)],
    binaries=[],
    datas=[],
    hiddenimports=['astropy.io.fits', 'flask_restful', 'h5py', 'pandas'],
    hookspath=[str(backend_dir / 'pyinstaller_hooks')],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['pytest'],
    noarchive=False,
    optimize=1,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='spectral-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=True,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
