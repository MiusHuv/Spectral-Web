"""Bundle the Astropy modules dynamically loaded by FITS export."""
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

datas = collect_data_files('astropy') + collect_data_files(
    'astropy.units.format',
    include_py_files=True,
    includes=['*_lextab.py', '*_parsetab.py'],
)
hiddenimports = (
    collect_submodules('astropy.constants')
    + collect_submodules('astropy.io.fits')
    + collect_submodules('astropy.table')
    + collect_submodules('astropy.units')
)
