"""
Factory for creating format converters.
"""

from importlib import import_module
from typing import Dict
from .base_converter import BaseFormatConverter


class FormatConverterFactory:
    """
    Factory class for creating format converter instances.
    
    Provides a centralized way to get the appropriate converter
    based on the requested export format.
    """
    
    def __init__(self):
        """Initialize the factory with available converters."""
        self._converters: Dict[str, tuple[str, str]] = {}
        self._register_converters()
    
    def _register_converters(self):
        """Register all available format converters."""
        # Keep optional scientific dependencies out of unrelated exports. In
        # particular, CSV/JSON export must not require Astropy's FITS modules.
        self._converters = {
            'csv': ('.csv_converter', 'CSVConverter'),
            'json': ('.json_converter', 'JSONConverter'),
            'hdf5': ('.hdf5_converter', 'HDF5Converter'),
            'fits': ('.fits_converter', 'FITSConverter'),
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
        
        module_name, class_name = self._converters[format_lower]
        try:
            module = import_module(module_name, package=__package__)
            converter_class = getattr(module, class_name)
        except ModuleNotFoundError as exc:
            raise ValueError(
                f"{format_lower.upper()} export is unavailable because a required dependency is missing."
            ) from exc
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
