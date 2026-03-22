"""
CSV format converter for data export.
"""

from typing import Optional, Dict, Any
import pandas as pd
import numpy as np
import io
import zipfile
from .base_converter import BaseFormatConverter


class CSVConverter(BaseFormatConverter):
    """
    Converter for CSV format export.
    
    For exports with spectral data, creates multiple CSV files:
    - metadata.csv: Object metadata and properties
    - spectra.csv: Spectral data in long format (id, wavelength, reflectance, uncertainty)
    - wavelengths.csv: Wavelength grid
    
    For metadata-only exports, returns a single CSV file.
    """
    
    def convert(
        self,
        data: pd.DataFrame,
        spectral_data: Optional[Dict[str, np.ndarray]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bytes:
        """
        Convert data to CSV format.
        
        Args:
            data: DataFrame containing object metadata and properties
            spectral_data: Optional dictionary with spectral arrays
            metadata: Optional export metadata
        
        Returns:
            Bytes representing CSV file(s), potentially in a ZIP archive
        """
        # If no spectral data, return single CSV
        if not spectral_data:
            return self._convert_metadata_only(data)
        
        reflectance = spectral_data.get('reflectance')
        if reflectance is None or (isinstance(reflectance, np.ndarray) and reflectance.size == 0):
            return self._convert_metadata_only(data)
        
        # With spectral data, create multiple CSVs in a ZIP
        return self._convert_with_spectral(data, spectral_data, metadata)
    
    def _convert_metadata_only(self, data: pd.DataFrame) -> bytes:
        """
        Convert metadata-only to single CSV.
        
        Args:
            data: DataFrame with object metadata
        
        Returns:
            CSV file as bytes with UTF-8 BOM
        """
        buffer = io.StringIO()
        data.to_csv(buffer, index=False, float_format='%.6f')
        csv_content = buffer.getvalue()
        
        # Add UTF-8 BOM for better Excel compatibility
        return '\ufeff'.encode('utf-8') + csv_content.encode('utf-8')
    
    def _convert_with_spectral(
        self,
        data: pd.DataFrame,
        spectral_data: Dict[str, Any],
        metadata: Optional[Dict[str, Any]]
    ) -> bytes:
        """
        Convert data with spectral information to multiple CSV files in ZIP.
        
        Args:
            data: DataFrame with object metadata
            spectral_data: Dictionary with wavelengths, reflectance, and optional uncertainty
            metadata: Optional export metadata
        
        Returns:
            ZIP archive containing multiple CSV files
        """
        zip_buffer = io.BytesIO()
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            # 1. Write metadata CSV
            metadata_csv = io.StringIO()
            data.to_csv(metadata_csv, index=False, float_format='%.6f')
            zf.writestr('metadata.csv', metadata_csv.getvalue())
            
            # Check if using original resolution (each observation has its own wavelength grid)
            is_original = spectral_data.get('resolution') == 'original'
            
            if not is_original:
                # 2. Write wavelengths CSV (only for resampled data with common grid)
                if 'wavelengths' in spectral_data and len(spectral_data['wavelengths']) > 0:
                    wavelengths_df = pd.DataFrame({
                        'wavelength': spectral_data['wavelengths']
                    })
                    wavelengths_csv = io.StringIO()
                    wavelengths_df.to_csv(wavelengths_csv, index=False, float_format='%.6f')
                    zf.writestr('wavelengths.csv', wavelengths_csv.getvalue())
            
            # 3. Write spectral data in long format
            spectra_csv = self._create_spectral_csv(
                spectral_data.get('wavelengths'),
                spectral_data.get('reflectance'),
                spectral_data.get('uncertainty'),
                spectral_data.get('item_ids', []),
                spectral_data.get('metadata', []),  # Pass metadata for observation IDs
                is_original=is_original
            )
            zf.writestr('spectra.csv', spectra_csv)
            
            # 4. Write README if metadata provided
            if metadata:
                readme = self._generate_readme(metadata)
                zf.writestr('README.txt', readme)
        
        zip_buffer.seek(0)
        return zip_buffer.read()
    
    def _create_spectral_csv(
        self,
        wavelengths,
        reflectance,
        uncertainty: Optional[np.ndarray],
        item_ids: list,
        metadata: Optional[list] = None,
        is_original: bool = False
    ) -> str:
        """
        Create spectral data CSV in long format.
        
        Args:
            wavelengths: Array or list of arrays of wavelength values
            reflectance: 2D array or list of arrays of reflectance values
            uncertainty: Optional 2D array of uncertainty values
            item_ids: List of item IDs corresponding to rows in reflectance array
            metadata: Optional list of metadata dicts with observation_id, etc.
            is_original: True if using original resolution (each obs has own wavelength grid)
        
        Returns:
            CSV string in long format
        """
        rows = []
        
        # Handle case where reflectance is empty
        if reflectance is None or len(reflectance) == 0:
            return "object_id,observation_id,wavelength,reflectance\n"
        
        # Iterate through each object/observation
        for obj_idx, object_id in enumerate(item_ids):
            if obj_idx >= len(reflectance):
                continue
                
            refl_values = reflectance[obj_idx]
            
            # Get wavelengths for this observation
            if is_original:
                # Each observation has its own wavelength grid
                if obj_idx >= len(wavelengths):
                    continue
                wl_values = wavelengths[obj_idx]
            else:
                # All observations share the same wavelength grid
                wl_values = wavelengths
            
            # Get observation_id from metadata if available
            observation_id = None
            observation_date = None
            data_source = None
            if metadata and obj_idx < len(metadata):
                observation_id = metadata[obj_idx].get('observation_id')
                observation_date = metadata[obj_idx].get('observation_date')
                data_source = metadata[obj_idx].get('data_source')
            
            # Iterate through each wavelength point
            for wl_idx, refl in enumerate(refl_values):
                if wl_idx >= len(wl_values):
                    continue
                    
                row = {
                    'object_id': object_id,
                    'observation_id': observation_id if observation_id is not None else '',
                    'wavelength': wl_values[wl_idx],
                    'reflectance': refl
                }
                
                # Add observation metadata (only on first wavelength to avoid repetition)
                if wl_idx == 0:
                    row['observation_date'] = observation_date if observation_date else ''
                    row['data_source'] = data_source if data_source else ''
                
                # Add uncertainty if available
                if uncertainty is not None and obj_idx < len(uncertainty):
                    if wl_idx < len(uncertainty[obj_idx]):
                        row['uncertainty'] = uncertainty[obj_idx][wl_idx]
                
                rows.append(row)
        
        # Create DataFrame and convert to CSV
        if not rows:
            return "object_id,wavelength,reflectance\n"
            
        spectra_df = pd.DataFrame(rows)
        buffer = io.StringIO()
        spectra_df.to_csv(buffer, index=False, float_format='%.6f')
        return buffer.getvalue()
    
    def _generate_readme(self, metadata: Dict[str, Any]) -> str:
        """
        Generate README content for CSV export.
        
        Args:
            metadata: Export metadata
        
        Returns:
            README text content
        """
        readme = """CSV Export Package
==================

This package contains spectral data exported from the Asteroid Spectral Database.

Files:
------
- metadata.csv: Object metadata and properties
- wavelengths.csv: Wavelength grid (in micrometers)
- spectra.csv: Spectral data in long format

Spectral Data Format:
--------------------
The spectra.csv file contains spectral measurements in long format with columns:
- object_id: Identifier for the object
- wavelength: Wavelength value (micrometers)
- reflectance: Reflectance value
- uncertainty: Measurement uncertainty (if available)

Usage Example (Python):
----------------------
import pandas as pd

# Load metadata
metadata = pd.read_csv('metadata.csv')

# Load spectral data
spectra = pd.read_csv('spectra.csv')

# Get spectrum for a specific object
object_spectrum = spectra[spectra['object_id'] == 'your_object_id']

Usage Example (R):
-----------------
# Load metadata
metadata <- read.csv('metadata.csv')

# Load spectral data
spectra <- read.csv('spectra.csv')

# Get spectrum for a specific object
object_spectrum <- spectra[spectra$object_id == 'your_object_id', ]

"""
        
        if metadata:
            readme += f"\nExport Information:\n"
            readme += f"-------------------\n"
            if 'timestamp' in metadata:
                readme += f"Export Date: {metadata['timestamp']}\n"
            if 'item_count' in metadata:
                readme += f"Number of Objects: {metadata['item_count']}\n"
            if 'version' in metadata:
                readme += f"Database Version: {metadata['version']}\n"
        
        return readme
    
    def get_mime_type(self) -> str:
        """Get MIME type for CSV format."""
        return 'text/csv'
    
    def get_file_extension(self) -> str:
        """Get file extension for CSV format."""
        return 'csv'
    
    def estimate_size(
        self,
        data: pd.DataFrame,
        spectral_data: Optional[Dict[str, np.ndarray]] = None
    ) -> int:
        """
        Estimate CSV file size.
        
        Args:
            data: DataFrame with metadata
            spectral_data: Optional spectral data
        
        Returns:
            Estimated size in bytes
        """
        # Estimate metadata CSV size (roughly 100 bytes per row per column)
        size = len(data) * len(data.columns) * 100
        
        if spectral_data and spectral_data.get('reflectance'):
            # Estimate spectral CSV size
            # Each row: object_id (20) + wavelength (10) + reflectance (10) + uncertainty (10) + delimiters
            num_objects = len(spectral_data['reflectance'])
            wavelength_count = len(spectral_data.get('wavelengths', []))
            size += num_objects * wavelength_count * 60
        
        # Add ZIP compression factor (roughly 30% compression)
        if spectral_data:
            size = int(size * 0.7)
        
        return size
