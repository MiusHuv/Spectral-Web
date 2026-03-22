"""
FITS format converter for data export.
"""

from typing import Optional, Dict, Any, List
import pandas as pd
import numpy as np
import io
from datetime import datetime
from astropy.io import fits
from astropy.table import Table
from .base_converter import BaseFormatConverter


class FITSConverter(BaseFormatConverter):
    """
    Converter for FITS (Flexible Image Transport System) format export.
    
    Creates a FITS file with multiple HDUs (Header Data Units):
    HDU 0 (Primary): Export metadata in header
    HDU 1 (BinTable): Object properties table
    HDU 2 (Image): Spectral data as 2D array (if spectral data included)
    HDU 3 (BinTable): Wavelength grid (if spectral data included)
    """
    
    def convert(
        self,
        data: pd.DataFrame,
        spectral_data: Optional[Dict[str, np.ndarray]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bytes:
        """
        Convert data to FITS format.
        
        Args:
            data: DataFrame containing object metadata and properties
            spectral_data: Optional dictionary with spectral arrays
            metadata: Optional export metadata
        
        Returns:
            FITS file as bytes
        """
        hdu_list = []
        
        # HDU 0: Primary HDU with metadata
        primary_hdu = self._create_primary_hdu(metadata, len(data))
        hdu_list.append(primary_hdu)
        
        # HDU 1: Object properties table
        properties_hdu = self._create_properties_hdu(data)
        hdu_list.append(properties_hdu)
        
        # Add spectral data HDUs if available
        if spectral_data and spectral_data.get('reflectance'):
            # HDU 2: Spectral data image
            spectra_hdu = self._create_spectra_hdu(spectral_data)
            hdu_list.append(spectra_hdu)
            
            # HDU 3: Wavelength table
            wavelength_hdu = self._create_wavelength_hdu(spectral_data)
            hdu_list.append(wavelength_hdu)
            
            # HDU 4: Uncertainty image (if available)
            if spectral_data.get('uncertainty'):
                uncertainty_hdu = self._create_uncertainty_hdu(spectral_data)
                hdu_list.append(uncertainty_hdu)
        
        # Create HDU list and write to bytes
        hdul = fits.HDUList(hdu_list)
        
        buffer = io.BytesIO()
        hdul.writeto(buffer)
        buffer.seek(0)
        
        return buffer.read()
    
    def _create_primary_hdu(
        self,
        metadata: Optional[Dict[str, Any]],
        object_count: int
    ) -> fits.PrimaryHDU:
        """
        Create primary HDU with export metadata in header.
        
        Args:
            metadata: Optional export metadata
            object_count: Number of objects
        
        Returns:
            Primary HDU
        """
        primary = fits.PrimaryHDU()
        
        # Add standard metadata to header
        primary.header['ORIGIN'] = 'Asteroid Spectral Database'
        primary.header['DATE'] = datetime.utcnow().isoformat() + 'Z'
        primary.header['NOBJ'] = (object_count, 'Number of objects')
        primary.header['COMMENT'] = 'Spectral data export from Asteroid Spectral Database'
        
        if metadata:
            # Add custom metadata fields
            if 'data_type' in metadata:
                primary.header['DATATYPE'] = metadata['data_type']
            if 'version' in metadata:
                primary.header['VERSION'] = metadata['version']
            if 'format' in metadata:
                primary.header['FORMAT'] = metadata['format']
            
            # Add any other metadata as comments or keywords
            for key, value in metadata.items():
                if key not in ['data_type', 'version', 'format']:
                    # FITS header keywords must be 8 chars or less
                    fits_key = key.upper()[:8]
                    if isinstance(value, (str, int, float, bool)):
                        try:
                            primary.header[fits_key] = value
                        except:
                            # If it fails, add as comment
                            primary.header['COMMENT'] = f'{key}: {value}'
        
        return primary
    
    def _create_properties_hdu(self, data: pd.DataFrame) -> fits.BinTableHDU:
        """
        Create binary table HDU with object properties.
        
        Args:
            data: DataFrame with object properties
        
        Returns:
            Binary table HDU
        """
        # Convert DataFrame to Astropy Table
        # Handle NaN values and data types
        table_data = {}
        
        for col in data.columns:
            col_data = data[col].values
            dtype = data[col].dtype
            
            if dtype == 'object':
                # Convert to string array, handling NaN
                col_data = np.array([str(x) if pd.notna(x) else '' for x in col_data])
            elif np.issubdtype(dtype, np.floating):
                # Replace NaN with FITS undefined value
                col_data = np.where(pd.isna(col_data), np.nan, col_data)
            
            table_data[col] = col_data
        
        # Create Astropy Table
        table = Table(table_data)
        
        # Convert to FITS BinTableHDU
        table_hdu = fits.BinTableHDU(table)
        table_hdu.name = 'PROPERTIES'
        table_hdu.header['EXTNAME'] = 'PROPERTIES'
        table_hdu.header['COMMENT'] = 'Object properties and metadata'
        
        return table_hdu
    
    def _create_spectra_hdu(
        self,
        spectral_data: Dict[str, np.ndarray]
    ) -> fits.ImageHDU:
        """
        Create image HDU with spectral data as 2D array.
        
        Args:
            spectral_data: Dictionary with spectral arrays
        
        Returns:
            Image HDU
        """
        reflectance_dict = spectral_data.get('reflectance', {})
        object_ids = list(reflectance_dict.keys())
        
        # Stack reflectance arrays into 2D array
        reflectance_arrays = [reflectance_dict[oid] for oid in object_ids]
        reflectance_2d = np.vstack(reflectance_arrays)
        
        # Create image HDU
        image_hdu = fits.ImageHDU(data=reflectance_2d)
        image_hdu.name = 'SPECTRA'
        image_hdu.header['EXTNAME'] = 'SPECTRA'
        image_hdu.header['BUNIT'] = 'Reflectance'
        image_hdu.header['COMMENT'] = 'Spectral reflectance data (objects x wavelengths)'
        image_hdu.header['NAXIS1'] = reflectance_2d.shape[1]
        image_hdu.header['NAXIS2'] = reflectance_2d.shape[0]
        
        # Store object IDs in header (if not too many)
        if len(object_ids) <= 100:
            for i, oid in enumerate(object_ids):
                image_hdu.header[f'OBJ{i:04d}'] = (oid, f'Object ID for row {i}')
        else:
            image_hdu.header['COMMENT'] = 'Object IDs stored in separate extension'
        
        return image_hdu
    
    def _create_wavelength_hdu(
        self,
        spectral_data: Dict[str, np.ndarray]
    ) -> fits.BinTableHDU:
        """
        Create binary table HDU with wavelength grid.
        
        Args:
            spectral_data: Dictionary with spectral arrays
        
        Returns:
            Binary table HDU
        """
        wavelengths = spectral_data.get('wavelengths', np.array([]))
        
        # Create table with wavelengths and object IDs
        reflectance_dict = spectral_data.get('reflectance', {})
        object_ids = list(reflectance_dict.keys())
        
        table_data = {
            'wavelength': wavelengths,
        }
        
        # Add object IDs as a column
        object_ids_array = np.array(object_ids, dtype='U50')
        
        # Create separate table for object IDs
        ids_table = Table({
            'object_id': object_ids_array,
            'row_index': np.arange(len(object_ids))
        })
        
        # Create wavelength table
        wave_table = Table(table_data)
        
        # Combine into single table
        combined_table = Table({
            'wavelength': wavelengths,
        })
        
        table_hdu = fits.BinTableHDU(combined_table)
        table_hdu.name = 'WAVELENGTH'
        table_hdu.header['EXTNAME'] = 'WAVELENGTH'
        table_hdu.header['TUNIT1'] = 'micrometer'
        table_hdu.header['COMMENT'] = 'Wavelength grid for spectral data'
        
        # Add object ID mapping in header
        table_hdu.header['COMMENT'] = 'Row indices in SPECTRA HDU correspond to:'
        for i, oid in enumerate(object_ids[:50]):  # Limit to first 50
            table_hdu.header['COMMENT'] = f'Row {i}: {oid}'
        
        return table_hdu
    
    def _create_uncertainty_hdu(
        self,
        spectral_data: Dict[str, np.ndarray]
    ) -> fits.ImageHDU:
        """
        Create image HDU with uncertainty data as 2D array.
        
        Args:
            spectral_data: Dictionary with spectral arrays
        
        Returns:
            Image HDU
        """
        uncertainty_dict = spectral_data.get('uncertainty', {})
        reflectance_dict = spectral_data.get('reflectance', {})
        object_ids = list(reflectance_dict.keys())
        
        # Stack uncertainty arrays into 2D array
        uncertainty_arrays = [
            uncertainty_dict.get(oid, np.full_like(reflectance_dict[oid], np.nan))
            for oid in object_ids
        ]
        uncertainty_2d = np.vstack(uncertainty_arrays)
        
        # Create image HDU
        image_hdu = fits.ImageHDU(data=uncertainty_2d)
        image_hdu.name = 'UNCERTAINTY'
        image_hdu.header['EXTNAME'] = 'UNCERTAINTY'
        image_hdu.header['BUNIT'] = 'Reflectance'
        image_hdu.header['COMMENT'] = 'Measurement uncertainty (objects x wavelengths)'
        
        return image_hdu
    
    def get_mime_type(self) -> str:
        """Get MIME type for FITS format."""
        return 'application/fits'
    
    def get_file_extension(self) -> str:
        """Get file extension for FITS format."""
        return 'fits'
    
    def estimate_size(
        self,
        data: pd.DataFrame,
        spectral_data: Optional[Dict[str, np.ndarray]] = None
    ) -> int:
        """
        Estimate FITS file size.
        
        Args:
            data: DataFrame with metadata
            spectral_data: Optional spectral data
        
        Returns:
            Estimated size in bytes
        """
        # FITS overhead (headers, padding)
        size = 5760  # FITS uses 2880-byte blocks
        
        # Primary HDU header
        size += 2880
        
        # Properties table (roughly 100 bytes per field per object)
        size += len(data) * len(data.columns) * 100
        
        if spectral_data and spectral_data.get('reflectance'):
            # Spectral image HDU
            num_objects = len(spectral_data['reflectance'])
            wavelength_count = len(spectral_data.get('wavelengths', []))
            
            # Image data (8 bytes per pixel for float64)
            size += num_objects * wavelength_count * 8
            
            # Wavelength table
            size += wavelength_count * 20
            
            # Uncertainty image if present
            if spectral_data.get('uncertainty'):
                size += num_objects * wavelength_count * 8
            
            # Additional headers
            size += 2880 * 3
        
        # FITS files are padded to 2880-byte blocks
        size = ((size // 2880) + 1) * 2880
        
        return size
