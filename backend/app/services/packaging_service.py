"""
Packaging service for export functionality.

This service handles creating ZIP archives for batch exports, generating
README files, and creating manifest files.
"""
import io
import json
import zipfile
from typing import Dict, Any, List
from datetime import datetime


class PackagingService:
    """Service for packaging export files into archives."""
    
    def create_package(
        self,
        files: Dict[str, bytes],
        manifest: Dict[str, Any]
    ) -> bytes:
        """
        Create ZIP archive with files and manifest.
        
        Args:
            files: Dictionary mapping filename to file content (bytes).
            manifest: Export manifest metadata.
            
        Returns:
            ZIP archive as bytes.
        """
        # Create in-memory ZIP file
        zip_buffer = io.BytesIO()
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            # Add all data files
            for filename, content in files.items():
                zip_file.writestr(filename, content)
            
            # Add manifest file
            manifest_json = json.dumps(manifest, indent=2, default=str)
            zip_file.writestr('manifest.json', manifest_json)
        
        zip_buffer.seek(0)
        return zip_buffer.getvalue()
    
    def generate_readme(
        self,
        data_type: str,
        item_count: int,
        format: str,
        config: Dict[str, Any]
    ) -> str:
        """
        Generate README content for export package.
        
        Args:
            data_type: Type of data ('asteroids' or 'meteorites').
            item_count: Number of items in export.
            format: Export format.
            config: Export configuration.
            
        Returns:
            README content as string.
        """
        timestamp = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')
        
        readme = f"""# Asteroid Spectral Database Export

## Export Information

- **Export Date**: {timestamp}
- **Data Type**: {data_type.capitalize()}
- **Format**: {format.upper()}
- **Item Count**: {item_count}

## File Structure

This export package contains the following files:

"""
        
        # Add format-specific file descriptions
        if format == 'csv':
            readme += """### CSV Files

- `metadata.csv`: Object metadata and properties
- `spectra.csv`: Spectral data in long format (id, wavelength, reflectance)
- `wavelengths.csv`: Wavelength grid used for spectral data

"""
        elif format == 'json':
            readme += """### JSON Files

- `export_data.json`: Complete export in nested JSON structure

"""
        elif format == 'hdf5':
            readme += """### HDF5 Files

- `export_data.h5`: Complete export in HDF5 format
  - `/metadata`: Export metadata
  - `/objects/properties`: Object properties as structured array
  - `/spectra/wavelengths`: Wavelength grid
  - `/spectra/reflectance`: Reflectance data (2D array)
  - `/spectra/uncertainty`: Uncertainty data (if available)

"""
        elif format == 'fits':
            readme += """### FITS Files

- `export_data.fits`: Complete export in FITS format
  - HDU 0 (Primary): Export metadata
  - HDU 1 (BinTable): Object properties
  - HDU 2 (Image): Spectral data array
  - HDU 3 (BinTable): Wavelength grid

"""
        
        readme += """### Additional Files

- `manifest.json`: Detailed manifest of exported items and configuration
- `README.md`: This file

## Data Usage

### Python Example

```python
import pandas as pd
import numpy as np

# For CSV format
metadata = pd.read_csv('metadata.csv')
spectra = pd.read_csv('spectra.csv')

# For JSON format
import json
with open('export_data.json', 'r') as f:
    data = json.load(f)

# For HDF5 format
import h5py
with h5py.File('export_data.h5', 'r') as f:
    wavelengths = f['spectra/wavelengths'][:]
    reflectance = f['spectra/reflectance'][:]

# For FITS format
from astropy.io import fits
with fits.open('export_data.fits') as hdul:
    metadata = hdul[1].data
    spectra = hdul[2].data
```

### R Example

```r
# For CSV format
metadata <- read.csv('metadata.csv')
spectra <- read.csv('spectra.csv')

# For JSON format
library(jsonlite)
data <- fromJSON('export_data.json')

# For HDF5 format
library(rhdf5)
h5_data <- h5read('export_data.h5', '/')
wavelengths <- h5_data$spectra$wavelengths
reflectance <- h5_data$spectra$reflectance

# For FITS format
library(FITSio)
fits_data <- readFITS('export_data.fits')
```

## File Naming Convention

Individual files follow the pattern:
- Single object: `{data_type}_{identifier}_{timestamp}.{extension}`
- Batch export: `{data_type}_batch_{count}items_{timestamp}.zip`
- Cart export: `cart_export_{count}items_{timestamp}.zip`

Timestamps use ISO 8601 format: YYYYMMDD_HHMMSS

## Data Precision

- Reflectance values: 6 decimal places minimum
- Wavelengths: Original precision preserved
- Uncertainties: Original precision preserved

## Data Provenance

- **Source**: Asteroid Spectral Database
- **Export Version**: 1.0
- **Database Version**: Current

## Support

For questions or issues with this export, please refer to the application
documentation or contact support.

## Citation

If you use this data in your research, please cite:
[Citation information to be added]

---
Generated by Asteroid Spectral Database Export System
"""
        
        return readme
    
    def generate_manifest(
        self,
        items: List[Dict[str, Any]],
        export_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate manifest file content.
        
        Args:
            items: List of exported items with their metadata.
            export_config: Export configuration used.
            
        Returns:
            Manifest dictionary.
        """
        manifest = {
            'export_metadata': {
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'version': '1.0',
                'generator': 'Asteroid Spectral Database Export System'
            },
            'export_configuration': export_config,
            'exported_items': {
                'count': len(items),
                'items': items
            },
            'data_provenance': {
                'source': 'Asteroid Spectral Database',
                'export_date': datetime.utcnow().isoformat() + 'Z'
            }
        }
        
        return manifest
