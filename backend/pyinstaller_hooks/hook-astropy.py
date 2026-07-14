"""Keep the desktop FITS dependency focused on the Astropy modules we use."""
from PyInstaller.utils.hooks import collect_data_files

datas = collect_data_files('astropy')
hiddenimports = [
    'astropy.io.fits',
    'astropy.io.fits.connect',
    'astropy.table',
]
