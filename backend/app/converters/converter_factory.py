"""
Factory for creating format converters.
"""

from typing import Dict, Type
from .base_converter import BaseFormatConverter


class FormatConverterFactory:
    """
    Factory class for creating format converter instances.
    
    Provides a centralized way to get the appropriate converter
    based on the requested export format.
    """
    
    def __init__(self):
        """Initialize the factory with available converters."""
        self._converters: Dict[str, Type[BaseFormatConverter]] = {}
        self._register_converters()
    
    def _register_converters(self):
        """Register all available format converters."""
        # Import converters here to avoid circular imports
        from .csv_converter import CSVConverter
        from .json_converter import JSONConverter
        from .hdf5_converter import HDF5Converter
        from .fits_converter import FITSConverter
        
        self._converters = {
            'csv': CSVConverter,
            'json': JSONConverter,
            'hdf5': HDF5Converter,
            'fits': FITSConverter
        }
    
    def get_converter(self, format: str) -> BaseFormatConverter:
        """
        Get converter for specified format.
        
        Args:
            format: Export format ('csv', 'json', 'hdf5', 'fits')
        
        Returns:
            Instance of the appropriate format converter
        
        Raises:
            ValueError: If format is not supported
        """
        format_lower = format.lower()
        
        if format_lower not in self._converters:
            supported = ', '.join(self._converters.keys())
            raise ValueError(
                f"Unsupported export format: {format}. "
                f"Supported formats: {supported}"
            )
        
        converter_class = self._converters[format_lower]
        return converter_class()
    
    def get_supported_formats(self) -> list:
        """
        Get list of supported export formats.
        
        Returns:
            List of supported format strings
        """
        return list(self._converters.keys())
    
    def is_format_supported(self, format: str) -> bool:
        """
        Check if a format is supported.
        
        Args:
            format: Format string to check
        
        Returns:
            True if format is supported, False otherwise
        """
        return format.lower() in self._converters
