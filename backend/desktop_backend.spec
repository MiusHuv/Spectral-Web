# -*- mode: python ; coding: utf-8 -*-
from pathlib import Path

backend_dir = Path(SPECPATH)

a = Analysis(
    [str(backend_dir / 'desktop_entry.py')],
    pathex=[str(backend_dir)],
    binaries=[],
    datas=[],
    # FormatConverterFactory imports converters lazily so CSV exports do not
    # load FITS/Astropy. PyInstaller cannot discover those string-based
    # imports statically, therefore keep the converter modules explicit.
    hiddenimports=[
        'app.converters.csv_converter',
        'app.converters.json_converter',
        'app.converters.hdf5_converter',
        'app.converters.fits_converter',
        'astropy.io.fits',
        'flask_restful',
        'h5py',
        'pandas',
    ],
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
