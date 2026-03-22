"""
JSON format converter for data export.
"""

from typing import Optional, Dict, Any, List
import pandas as pd
import numpy as np
import json
from datetime import datetime
from .base_converter import BaseFormatConverter


class NumpyEncoder(json.JSONEncoder):
    """Custom JSON encoder for numpy types."""
    
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(obj, pd.Timestamp):
            return obj.isoformat()
        elif pd.isna(obj):
            return None
        return super().default(obj)


class JSONConverter(BaseFormatConverter):
    """
    Converter for JSON format export.
    
    Creates a nested JSON structure with:
    - metadata: Export information
    - objects: Array of objects with properties and optional spectra
    """
    
    def convert(
        self,
        data: pd.DataFrame,
        spectral_data: Optional[Dict[str, np.ndarray]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bytes:
        """
        Convert data to JSON format.
        
        Args:
            data: DataFrame containing object metadata and properties
            spectral_data: Optional dictionary with spectral arrays
            metadata: Optional export metadata
        
        Returns:
            JSON file as bytes
        """
        # Build the JSON structure
        json_structure = {
            'metadata': self._build_metadata(metadata, len(data)),
            'objects': self._build_objects(data, spectral_data)
        }
        
        # Convert to JSON string with proper formatting
        json_string = json.dumps(
            json_structure,
            cls=NumpyEncoder,
            indent=2,
            ensure_ascii=False
        )
        
        return json_string.encode('utf-8')
    
    def _build_metadata(
        self,
        metadata: Optional[Dict[str, Any]],
        object_count: int
    ) -> Dict[str, Any]:
        """
        Build metadata section of JSON.
        
        Args:
            metadata: Optional export metadata
            object_count: Number of objects in export
        
        Returns:
            Metadata dictionary
        """
        meta = {
            'export_date': datetime.utcnow().isoformat() + 'Z',
            'object_count': object_count,
            'source': 'Asteroid Spectral Database'
        }
        
        if metadata:
            meta.update({
                'format': metadata.get('format', 'json'),
                'version': metadata.get('version', '1.0'),
                'data_type': metadata.get('data_type', 'unknown')
            })
            
            # Add any custom metadata fields
            for key, value in metadata.items():
                if key not in meta:
                    meta[key] = value
        
        return meta
    
    def _build_objects(
        self,
        data: pd.DataFrame,
        spectral_data: Optional[Dict[str, np.ndarray]]
    ) -> List[Dict[str, Any]]:
        """
        Build objects array for JSON.
        
        Args:
            data: DataFrame with object metadata
            spectral_data: Optional spectral data dictionary
        
        Returns:
            List of object dictionaries
        """
        objects = []
        
        for _, row in data.iterrows():
            obj = self._build_object(row, spectral_data)
            objects.append(obj)
        
        return objects
    
    def _build_object(
        self,
        row: pd.Series,
        spectral_data: Optional[Dict[str, np.ndarray]]
    ) -> Dict[str, Any]:
        """
        Build a single object dictionary.
        
        Args:
            row: DataFrame row with object data
            spectral_data: Optional spectral data
        
        Returns:
            Object dictionary
        """
        # Get object ID (try common ID column names)
        object_id = None
        for id_col in ['id', 'object_id', 'asteroid_id', 'meteorite_id', 'name']:
            if id_col in row.index:
                object_id = row[id_col]
                break
        
        # Build base object with all properties
        obj = {
            'id': object_id,
            'properties': {}
        }
        
        # Add all row data as properties
        for key, value in row.items():
            # Skip if this is the ID field we already used
            if key in ['id', 'object_id', 'asteroid_id', 'meteorite_id'] and value == object_id:
                continue
            
            # Convert pandas/numpy types to JSON-serializable types
            if pd.isna(value):
                obj['properties'][key] = None
            elif isinstance(value, (np.integer, np.floating)):
                obj['properties'][key] = float(value) if isinstance(value, np.floating) else int(value)
            elif isinstance(value, pd.Timestamp):
                obj['properties'][key] = value.isoformat()
            else:
                obj['properties'][key] = value
        
        # Add spectral data if available
        if spectral_data and object_id:
            spectrum = self._build_spectrum(object_id, spectral_data)
            if spectrum:
                obj['spectrum'] = spectrum
        
        return obj
    
    def _build_spectrum(
        self,
        object_id: str,
        spectral_data: Dict[str, np.ndarray]
    ) -> Optional[Dict[str, Any]]:
        """
        Build spectrum dictionary for an object.
        
        Args:
            object_id: Object identifier
            spectral_data: Spectral data dictionary
        
        Returns:
            Spectrum dictionary or None if no data available
        """
        reflectance_dict = spectral_data.get('reflectance', {})
        
        # Check if this object has spectral data
        if object_id not in reflectance_dict:
            return None
        
        spectrum = {}
        
        # Add wavelengths
        if 'wavelengths' in spectral_data:
            spectrum['wavelengths'] = spectral_data['wavelengths'].tolist()
        
        # Add reflectance
        spectrum['reflectance'] = reflectance_dict[object_id].tolist()
        
        # Add uncertainty if available
        uncertainty_dict = spectral_data.get('uncertainty', {})
        if object_id in uncertainty_dict:
            spectrum['uncertainty'] = uncertainty_dict[object_id].tolist()
        
        # Add observation metadata if available
        obs_metadata = spectral_data.get('observation_metadata', {})
        if object_id in obs_metadata:
            spectrum['observation'] = obs_metadata[object_id]
        
        return spectrum
    
    def get_mime_type(self) -> str:
        """Get MIME type for JSON format."""
        return 'application/json'
    
    def get_file_extension(self) -> str:
        """Get file extension for JSON format."""
        return 'json'
    
    def estimate_size(
        self,
        data: pd.DataFrame,
        spectral_data: Optional[Dict[str, np.ndarray]] = None
    ) -> int:
        """
        Estimate JSON file size.
        
        Args:
            data: DataFrame with metadata
            spectral_data: Optional spectral data
        
        Returns:
            Estimated size in bytes
        """
        # Base size for metadata structure
        size = 500
        
        # Estimate object properties size (roughly 150 bytes per field per object)
        size += len(data) * len(data.columns) * 150
        
        if spectral_data and spectral_data.get('reflectance'):
            # Estimate spectral data size
            # JSON arrays are verbose: each number ~15 chars, plus formatting
            num_objects = len(spectral_data['reflectance'])
            wavelength_count = len(spectral_data.get('wavelengths', []))
            
            # Wavelengths array (shared)
            size += wavelength_count * 15
            
            # Reflectance arrays (per object)
            size += num_objects * wavelength_count * 15
            
            # Uncertainty arrays if present
            if spectral_data.get('uncertainty'):
                size += num_objects * wavelength_count * 15
        
        return size
