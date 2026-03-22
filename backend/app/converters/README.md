# Format Converters

This module provides format converters for exporting spectral data in various scientific formats.

## Architecture

The converter system uses a factory pattern with a base abstract class that all converters implement.

### Components

1. **BaseFormatConverter** - Abstract base class defining the converter interface
2. **FormatConverterFactory** - Factory for creating converter instances
3. **CSVConverter** - Converts data to CSV format
4. **JSONConverter** - Converts data to JSON format
5. **HDF5Converter** - Converts data to HDF5 format
6. **FITSConverter** - Converts data to FITS format

## Usage

```python
from app.converters import FormatConverterFactory
import pandas as pd
import numpy as np

# Create factory
factory = FormatConverterFactory()

# Get converter for desired format
converter = factory.get_converter('csv')

# Prepare data
data = pd.DataFrame({
    'id': ['obj1', 'obj2'],
    'name': ['Object 1', 'Object 2'],
    'classification': ['S-type', 'C-type']
})

# Optional: Add spectral data
spectral_data = {
    'wavelengths': np.array([0.5, 0.7, 0.9]),
    'reflectance': {
        'obj1': np.array([0.8, 0.85, 0.9]),
        'obj2': np.array([0.3, 0.35, 0.4])
    },
    'uncertainty': {
        'obj1': np.array([0.01, 0.01, 0.02]),
        'obj2': np.array([0.02, 0.02, 0.03])
    }
}

# Convert
result = converter.convert(data, spectral_data)

# Get format info
mime_type = converter.get_mime_type()
extension = converter.get_file_extension()
```

## Format Details

### CSV Format

- **Extension**: `.csv`
- **MIME Type**: `text/csv`
- **Structure**:
  - Metadata only: Single CSV file
  - With spectral data: ZIP archive containing:
    - `metadata.csv` - Object properties
    - `wavelengths.csv` - Wavelength grid
    - `spectra.csv` - Spectral data in long format
    - `README.txt` - Usage instructions

### JSON Format

- **Extension**: `.json`
- **MIME Type**: `application/json`
- **Structure**:
  ```json
  {
    "metadata": {
      "export_date": "...",
      "object_count": 2,
      "source": "..."
    },
    "objects": [
      {
        "id": "obj1",
        "properties": {...},
        "spectrum": {
          "wavelengths": [...],
          "reflectance": [...],
          "uncertainty": [...]
        }
      }
    ]
  }
  ```

### HDF5 Format

- **Extension**: `.h5`
- **MIME Type**: `application/x-hdf5`
- **Structure**:
  ```
  /metadata (group)
      - attributes: export_date, object_count, etc.
  /objects (group)
      /properties (dataset - structured array)
  /spectra (group)
      /wavelengths (dataset)
      /reflectance (dataset - 2D array)
      /uncertainty (dataset - 2D array)
      /object_ids (dataset)
  ```

### FITS Format

- **Extension**: `.fits`
- **MIME Type**: `application/fits`
- **Structure**:
  - HDU 0 (Primary): Export metadata in header
  - HDU 1 (BinTable): Object properties
  - HDU 2 (Image): Spectral reflectance (2D array)
  - HDU 3 (BinTable): Wavelength grid
  - HDU 4 (Image): Uncertainty data (if available)

## Adding New Formats

To add a new format converter:

1. Create a new file `{format}_converter.py`
2. Implement a class that inherits from `BaseFormatConverter`
3. Implement required methods:
   - `convert(data, spectral_data, metadata) -> bytes`
   - `get_mime_type() -> str`
   - `get_file_extension() -> str`
4. Optionally override `estimate_size()` for better size estimates
5. Register the converter in `FormatConverterFactory._register_converters()`

## Dependencies

- **pandas**: Data manipulation
- **numpy**: Array operations
- **h5py**: HDF5 file format (install: `pip install h5py`)
- **astropy**: FITS file format (install: `pip install astropy`)

## Testing

Basic test to verify converters work:

```python
from app.converters import FormatConverterFactory

factory = FormatConverterFactory()
print('Supported formats:', factory.get_supported_formats())

for fmt in factory.get_supported_formats():
    converter = factory.get_converter(fmt)
    print(f'{fmt}: {converter.get_mime_type()}')
```
