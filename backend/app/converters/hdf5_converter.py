"""
HDF5 format converter for data export.
"""

from typing import Optional, Dict, Any
import pandas as pd
import numpy as np
import h5py
import io
from datetime import datetime
from .base_converter import BaseFormatConverter


class HDF5Converter(BaseFormatConverter):
    """
    Converter for HDF5 format export.
    
    Creates an HDF5 file with hierarchical structure:
    /metadata (group)
        /export_info (dataset with attributes)
    /objects (group)
        /properties (dataset - structured array or table)
    /spectra (group)
        /wavelengths (dataset)
        /reflectance (dataset - 2D array)
        /uncertainty (dataset - 2D array, optional)
        /object_ids (dataset)
    """
    
    def convert(
        self,
        data: pd.DataFrame,
        spectral_data: Optional[Dict[str, np.ndarray]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bytes:
        """
        Convert data to HDF5 format.
        
        Args:
            data: DataFrame containing object metadata and properties
            spectral_data: Optional dictionary with spectral arrays
            metadata: Optional export metadata
        
        Returns:
            HDF5 file as bytes
        """
        # Create HDF5 file in memory
        buffer = io.BytesIO()
        
        with h5py.File(buffer, 'w') as f:
            # Create metadata group
            self._write_metadata(f, metadata, len(data))
            
            # Create objects group with properties
            self._write_objects(f, data)
            
            # Create spectra group if spectral data provided
            if spectral_data and spectral_data.get('reflectance'):
                self._write_spectra(f, spectral_data)
        
        buffer.seek(0)
        return buffer.read()
    
    def _write_metadata(
        self,
        f: h5py.File,
        metadata: Optional[Dict[str, Any]],
        object_count: int
    ):
        """
        Write metadata group to HDF5 file.
        
        Args:
            f: HDF5 file object
            metadata: Optional export metadata
            object_count: Number of objects
        """
        meta_group = f.create_group('metadata')
        
        # Set attributes on the metadata group
        meta_group.attrs['export_date'] = datetime.utcnow().isoformat() + 'Z'
        meta_group.attrs['object_count'] = object_count
        meta_group.attrs['source'] = 'Asteroid Spectral Database'
        meta_group.attrs['format_version'] = '1.0'
        
        if metadata:
            for key, value in metadata.items():
                # Only store simple types as attributes
                if isinstance(value, (str, int, float, bool)):
                    meta_group.attrs[key] = value
    
    def _write_objects(self, f: h5py.File, data: pd.DataFrame):
        """
        Write objects group with properties to HDF5 file.
        
        Args:
            f: HDF5 file object
            data: DataFrame with object properties
        """
        objects_group = f.create_group('objects')
        
        # Convert DataFrame to structured array for efficient storage
        # Handle different data types appropriately
        dtypes = []
        for col in data.columns:
            dtype = data[col].dtype
            
            if dtype == 'object':
                # String columns - use variable length string
                dtypes.append((col, h5py.string_dtype(encoding='utf-8')))
            elif np.issubdtype(dtype, np.integer):
                dtypes.append((col, 'i8'))
            elif np.issubdtype(dtype, np.floating):
                dtypes.append((col, 'f8'))
            elif np.issubdtype(dtype, np.bool_):
                dtypes.append((col, 'bool'))
            else:
                # Default to string for unknown types
                dtypes.append((col, h5py.string_dtype(encoding='utf-8')))
        
        # Create structured array
        structured_array = np.zeros(len(data), dtype=dtypes)
        
        for col in data.columns:
            col_data = data[col].values
            
            # Handle NaN values
            if data[col].dtype == 'object':
                # Convert to string, replacing NaN with empty string
                col_data = [str(x) if pd.notna(x) else '' for x in col_data]
            elif np.issubdtype(data[col].dtype, np.floating):
                # Keep NaN as is for float columns
                pass
            
            structured_array[col] = col_data
        
        # Write as dataset
        properties_ds = objects_group.create_dataset(
            'properties',
            data=structured_array,
            compression='gzip',
            compression_opts=4
        )
        
        # Add column descriptions as attributes
        properties_ds.attrs['description'] = 'Object properties and metadata'
        properties_ds.attrs['columns'] = list(data.columns)
    
    def _write_spectra(
        self,
        f: h5py.File,
        spectral_data: Dict[str, np.ndarray]
    ):
        """
        Write spectra group to HDF5 file.
        
        Args:
            f: HDF5 file object
            spectral_data: Dictionary with spectral arrays
        """
        spectra_group = f.create_group('spectra')
        
        # Write wavelengths
        if 'wavelengths' in spectral_data:
            wavelengths_ds = spectra_group.create_dataset(
                'wavelengths',
                data=spectral_data['wavelengths'],
                compression='gzip',
                compression_opts=4
            )
            wavelengths_ds.attrs['units'] = 'micrometers'
            wavelengths_ds.attrs['description'] = 'Wavelength grid'
        
        # Prepare reflectance data as 2D array
        reflectance_dict = spectral_data.get('reflectance', {})
        if reflectance_dict:
            object_ids = list(reflectance_dict.keys())
            reflectance_arrays = [reflectance_dict[oid] for oid in object_ids]
            
            # Stack into 2D array (objects x wavelengths)
            reflectance_2d = np.vstack(reflectance_arrays)
            
            # Write reflectance dataset
            reflectance_ds = spectra_group.create_dataset(
                'reflectance',
                data=reflectance_2d,
                compression='gzip',
                compression_opts=4
            )
            reflectance_ds.attrs['description'] = 'Reflectance values (objects x wavelengths)'
            reflectance_ds.attrs['shape'] = f'{len(object_ids)} objects x {reflectance_2d.shape[1]} wavelengths'
            
            # Write object IDs for indexing
            object_ids_ds = spectra_group.create_dataset(
                'object_ids',
                data=np.array(object_ids, dtype=h5py.string_dtype(encoding='utf-8')),
                compression='gzip',
                compression_opts=4
            )
            object_ids_ds.attrs['description'] = 'Object IDs corresponding to reflectance rows'
            
            # Write uncertainty if available
            uncertainty_dict = spectral_data.get('uncertainty', {})
            if uncertainty_dict:
                uncertainty_arrays = [
                    uncertainty_dict.get(oid, np.full_like(reflectance_dict[oid], np.nan))
                    for oid in object_ids
                ]
                uncertainty_2d = np.vstack(uncertainty_arrays)
                
                uncertainty_ds = spectra_group.create_dataset(
                    'uncertainty',
                    data=uncertainty_2d,
                    compression='gzip',
                    compression_opts=4
                )
                uncertainty_ds.attrs['description'] = 'Measurement uncertainty (objects x wavelengths)'
        
        # Add usage instructions as group attribute
        spectra_group.attrs['usage'] = (
            'To access spectrum for object i: '
            'wavelengths = spectra/wavelengths[:], '
            'reflectance = spectra/reflectance[i, :], '
            'object_id = spectra/object_ids[i]'
        )
    
    def get_mime_type(self) -> str:
        """Get MIME type for HDF5 format."""
        return 'application/x-hdf5'
    
    def get_file_extension(self) -> str:
        """Get file extension for HDF5 format."""
        return 'h5'
    
    def estimate_size(
        self,
        data: pd.DataFrame,
        spectral_data: Optional[Dict[str, np.ndarray]] = None
    ) -> int:
        """
        Estimate HDF5 file size.
        
        Args:
            data: DataFrame with metadata
            spectral_data: Optional spectral data
        
        Returns:
            Estimated size in bytes
        """
        # HDF5 overhead
        size = 10000
        
        # Estimate properties dataset size
        # Structured array is efficient, roughly 50 bytes per field per object
        size += len(data) * len(data.columns) * 50
        
        if spectral_data and spectral_data.get('reflectance'):
            # Wavelengths (8 bytes per value)
            wavelength_count = len(spectral_data.get('wavelengths', []))
            size += wavelength_count * 8
            
            # Reflectance 2D array (8 bytes per value)
            num_objects = len(spectral_data['reflectance'])
            size += num_objects * wavelength_count * 8
            
            # Uncertainty if present
            if spectral_data.get('uncertainty'):
                size += num_objects * wavelength_count * 8
            
            # Object IDs (roughly 20 bytes per ID)
            size += num_objects * 20
        
        # Apply compression factor (gzip typically achieves 30-50% compression)
        size = int(size * 0.6)
        
        return size
