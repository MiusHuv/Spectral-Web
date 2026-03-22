"""
Base format converter abstract class.
"""

from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
import pandas as pd
import numpy as np


class BaseFormatConverter(ABC):
    """
    Abstract base class for format converters.
    
    All format converters must implement the convert method to transform
    data into their specific format, and provide metadata about the format.
    """
    
    @abstractmethod
    def convert(
        self,
        data: pd.DataFrame,
        spectral_data: Optional[Dict[str, np.ndarray]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bytes:
        """
        Convert data to target format.
        
        Args:
            data: DataFrame containing object metadata and properties
            spectral_data: Optional dictionary mapping object IDs to spectral arrays
                          Format: {
                              'wavelengths': np.ndarray,
                              'reflectance': Dict[str, np.ndarray],
                              'uncertainty': Dict[str, np.ndarray] (optional)
                          }
            metadata: Optional export metadata (timestamp, version, etc.)
        
        Returns:
            Bytes representing the converted data in target format
        """
        pass
    
    @abstractmethod
    def get_mime_type(self) -> str:
        """
        Get MIME type for this format.
        
        Returns:
            MIME type string (e.g., 'text/csv', 'application/json')
        """
        pass
    
    @abstractmethod
    def get_file_extension(self) -> str:
        """
        Get file extension for this format.
        
        Returns:
            File extension without dot (e.g., 'csv', 'json', 'h5')
        """
        pass
    
    def estimate_size(
        self,
        data: pd.DataFrame,
        spectral_data: Optional[Dict[str, np.ndarray]] = None
    ) -> int:
        """
        Estimate the size of the converted file in bytes.
        
        This is a default implementation that can be overridden by subclasses
        for more accurate format-specific estimates.
        
        Args:
            data: DataFrame containing object metadata
            spectral_data: Optional spectral data dictionary
        
        Returns:
            Estimated size in bytes
        """
        # Basic estimation: sum of data memory usage
        size = data.memory_usage(deep=True).sum()
        
        if spectral_data:
            # Add spectral data size
            if 'wavelengths' in spectral_data:
                size += spectral_data['wavelengths'].nbytes
            if 'reflectance' in spectral_data:
                for arr in spectral_data['reflectance'].values():
                    size += arr.nbytes
            if 'uncertainty' in spectral_data:
                for arr in spectral_data['uncertainty'].values():
                    size += arr.nbytes
        
        # Add overhead factor (varies by format)
        return int(size * 1.2)
