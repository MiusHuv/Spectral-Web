"""
Data models for export functionality.

This module defines the data structures used for configuring and managing
data exports in the asteroid spectral database application.
"""
from dataclasses import dataclass, field
from typing import List, Optional, Tuple, Dict, Any
from datetime import datetime


@dataclass
class SpectralOptions:
    """Configuration for spectral data export options."""
    
    wavelength_range: Optional[Tuple[float, float]] = None
    """Optional wavelength range filter (min, max) in micrometers."""
    
    resolution: str = 'original'
    """Data resolution: 'original' or 'resampled'."""
    
    include_uncertainty: bool = True
    """Whether to include measurement uncertainties."""
    
    include_metadata: bool = True
    """Whether to include observation metadata (date, instrument, mission)."""
    
    def validate(self) -> bool:
        """Validate spectral options configuration."""
        if self.resolution not in ['original', 'resampled']:
            raise ValueError(f"Invalid resolution: {self.resolution}. Must be 'original' or 'resampled'")
        
        if self.wavelength_range is not None:
            if len(self.wavelength_range) != 2:
                raise ValueError("wavelength_range must be a tuple of (min, max)")
            if self.wavelength_range[0] >= self.wavelength_range[1]:
                raise ValueError("wavelength_range min must be less than max")
            if self.wavelength_range[0] < 0:
                raise ValueError("wavelength_range values must be positive")
        
        return True


@dataclass
class IncludeFields:
    """Configuration for which data fields to include in export."""
    
    basic_info: bool = True
    """Include basic identification fields (name, designation, etc.)."""
    
    classification: bool = True
    """Include taxonomic classification fields."""
    
    orbital_params: bool = True
    """Include orbital parameter fields."""
    
    physical_props: bool = True
    """Include physical property fields (diameter, albedo, etc.)."""
    
    spectral_data: bool = True
    """Include spectral data arrays."""
    
    def has_any_selected(self) -> bool:
        """Check if at least one field category is selected."""
        return any([
            self.basic_info,
            self.classification,
            self.orbital_params,
            self.physical_props,
            self.spectral_data
        ])


@dataclass
class ExportConfig:
    """Complete configuration for a data export operation."""
    
    item_ids: List[str]
    """List of item IDs to export."""
    
    data_type: str
    """Type of data: 'asteroids' or 'meteorites'."""
    
    format: str
    """Export format: 'csv', 'json', 'hdf5', or 'fits'."""
    
    include_fields: IncludeFields
    """Configuration for which fields to include."""
    
    spectral_options: Optional[SpectralOptions] = None
    """Optional spectral data configuration."""
    
    def validate(self) -> bool:
        """
        Validate export configuration.
        
        Returns:
            bool: True if configuration is valid.
            
        Raises:
            ValueError: If configuration is invalid.
        """
        # Validate item IDs
        if not self.item_ids or len(self.item_ids) == 0:
            raise ValueError("No items selected for export")
        
        if len(self.item_ids) > 1000:
            raise ValueError(f"Maximum 1000 items per export. Requested: {len(self.item_ids)}")
        
        # Validate data type
        if self.data_type not in ['asteroids', 'meteorites']:
            raise ValueError(f"Invalid data_type: {self.data_type}. Must be 'asteroids' or 'meteorites'")
        
        # Validate format
        if self.format not in ['csv', 'json', 'hdf5', 'fits']:
            raise ValueError(f"Unsupported format: {self.format}")
        
        # Validate at least one field is selected
        if not self.include_fields.has_any_selected():
            raise ValueError("At least one field category must be selected")
        
        # Validate spectral options if provided
        if self.spectral_options is not None:
            self.spectral_options.validate()
        
        return True
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ExportConfig':
        """
        Create ExportConfig from dictionary.
        
        Args:
            data: Dictionary containing export configuration.
            
        Returns:
            ExportConfig instance.
        """
        include_fields_data = data.get('include_fields', {})
        include_fields = IncludeFields(
            basic_info=include_fields_data.get('basic_info', True),
            classification=include_fields_data.get('classification', True),
            orbital_params=include_fields_data.get('orbital_params', True),
            physical_props=include_fields_data.get('physical_props', True),
            spectral_data=include_fields_data.get('spectral_data', True)
        )
        
        spectral_options = None
        if 'spectral_options' in data and data['spectral_options'] is not None:
            spectral_data = data['spectral_options']
            spectral_options = SpectralOptions(
                wavelength_range=tuple(spectral_data['wavelength_range']) if spectral_data.get('wavelength_range') else None,
                resolution=spectral_data.get('resolution', 'original'),
                include_uncertainty=spectral_data.get('include_uncertainty', True),
                include_metadata=spectral_data.get('include_metadata', True)
            )
        
        return cls(
            item_ids=data.get('item_ids', []),
            data_type=data.get('data_type', 'asteroids'),
            format=data.get('format', 'csv'),
            include_fields=include_fields,
            spectral_options=spectral_options
        )


@dataclass
class ExportResult:
    """Result of an export operation."""
    
    content: bytes
    """Binary content of the exported file."""
    
    filename: str
    """Generated filename for the export."""
    
    mime_type: str
    """MIME type for the exported content."""
    
    size_bytes: int
    """Size of the exported content in bytes."""
    
    item_count: int
    """Number of items included in the export."""
    
    format: str
    """Export format used."""
    
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat() + 'Z')
    """Timestamp of export creation."""
    
    @property
    def size_human_readable(self) -> str:
        """Get human-readable file size."""
        size = self.size_bytes
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024.0:
                return f"{size:.2f} {unit}"
            size /= 1024.0
        return f"{size:.2f} TB"
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation."""
        return {
            'filename': self.filename,
            'mime_type': self.mime_type,
            'size_bytes': self.size_bytes,
            'size_human_readable': self.size_human_readable,
            'item_count': self.item_count,
            'format': self.format,
            'timestamp': self.timestamp
        }
