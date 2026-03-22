"""
Export service for asteroid spectral data.

This service coordinates the export process, including data retrieval,
format conversion, and packaging.
"""
from typing import Tuple, Dict, Any, List, Optional, Callable
from datetime import datetime
from flask import current_app
import pandas as pd
import numpy as np

from app.services.database_service import FlaskDatabaseService
from app.services.data_retrieval_service import DataRetrievalService
from app.services.packaging_service import PackagingService
from app.models.export_models import ExportConfig, ExportResult
from app.converters.converter_factory import FormatConverterFactory


class ExportService:
    """Main service for coordinating data export operations."""
    
    def __init__(self, db_service: FlaskDatabaseService):
        """
        Initialize export service.
        
        Args:
            db_service: Database service instance.
        """
        self.db_service = db_service
        self.data_retrieval = DataRetrievalService(db_service)
        self.packaging = PackagingService()
        self.converter_factory = FormatConverterFactory()
        self._progress_callback: Optional[Callable[[int, str], None]] = None
    
    def set_progress_callback(self, callback: Callable[[int, str], None]) -> None:
        """
        Set progress callback for tracking export progress.
        
        Args:
            callback: Function that takes (progress_percent, status_message) as arguments.
        """
        self._progress_callback = callback
    
    def _report_progress(self, percent: int, message: str) -> None:
        """
        Report progress if callback is set.
        
        Args:
            percent: Progress percentage (0-100).
            message: Status message.
        """
        if self._progress_callback:
            self._progress_callback(percent, message)
        current_app.logger.info(f"Export progress: {percent}% - {message}")
    
    def export_data(
        self,
        config: ExportConfig
    ) -> ExportResult:
        """
        Export data for specified items with progress tracking.
        
        Args:
            config: Export configuration.
            
        Returns:
            ExportResult containing file content and metadata.
            
        Raises:
            ValueError: If configuration is invalid.
            Exception: If export processing fails.
        """
        # Validate configuration
        config.validate()
        
        try:
            current_app.logger.info(f"Starting export: {config.data_type}, format={config.format}, items={len(config.item_ids)}")
            self._report_progress(0, "Starting export...")
            
            # Retrieve data based on data type
            self._report_progress(10, "Retrieving metadata...")
            current_app.logger.info(f"Retrieving {config.data_type} metadata for {len(config.item_ids)} items")
            
            if config.data_type == 'asteroids':
                data = self.data_retrieval.get_asteroid_data(
                    config.item_ids,
                    config.include_fields,
                    config.spectral_options
                )
            else:  # meteorites
                data = self.data_retrieval.get_meteorite_data(
                    config.item_ids,
                    config.include_fields,
                    config.spectral_options
                )
            
            if data is None or data.empty:
                error_msg = f"No data found for {config.data_type} with IDs: {config.item_ids}"
                current_app.logger.error(error_msg)
                raise ValueError(error_msg)
            
            current_app.logger.info(f"Retrieved {len(data)} records")
            
            # Retrieve spectral data if requested
            spectral_data = None
            if config.include_fields.spectral_data and config.spectral_options:
                self._report_progress(30, "Retrieving spectral data...")
                current_app.logger.info("Retrieving spectral data...")
                
                try:
                    spectral_data = self.data_retrieval.get_spectral_data(
                        config.item_ids,
                        config.data_type,
                        config.spectral_options
                    )
                    if spectral_data:
                        current_app.logger.info(f"Retrieved spectral data for {len(spectral_data.get('item_ids', []))} items")
                except Exception as e:
                    current_app.logger.warning(f"Failed to retrieve spectral data: {e}. Continuing without spectral data.")
                    # Don't fail the entire export if spectral data retrieval fails
                    spectral_data = None
            
            # Determine if batch export (multiple items)
            is_batch = len(config.item_ids) > 1
            
            self._report_progress(50, "Converting data...")
            current_app.logger.info(f"Converting to {config.format} format (batch={is_batch})")
            
            if is_batch:
                # Create batch export with packaging
                result = self._create_batch_export(config, data, spectral_data)
            else:
                # Create single file export
                result = self._create_single_export(config, data, spectral_data)
            
            current_app.logger.info(f"Export complete: {result.filename} ({result.size_human_readable})")
            self._report_progress(100, "Export complete")
            return result
        
        except ValueError as e:
            current_app.logger.error(f"Validation error in export: {e}")
            self._report_progress(0, f"Export failed: {str(e)}")
            raise
        except Exception as e:
            current_app.logger.error(f"Export failed with unexpected error: {e}", exc_info=True)
            self._report_progress(0, f"Export failed: {str(e)}")
            raise
    
    def estimate_size(
        self,
        config: ExportConfig
    ) -> int:
        """
        Estimate export file size in bytes.
        
        Args:
            config: Export configuration.
            
        Returns:
            Estimated size in bytes.
        """
        # Validate configuration
        config.validate()
        
        try:
            # Calculate metadata size based on included fields
            metadata_size_per_item = self._estimate_metadata_size(config.include_fields)
            
            # Calculate spectral data size
            spectral_size_per_item = 0
            if config.include_fields.spectral_data and config.spectral_options:
                spectral_size_per_item = self._estimate_spectral_size(config.spectral_options)
            
            # Calculate base size
            base_size = len(config.item_ids) * (metadata_size_per_item + spectral_size_per_item)
            
            # Apply format-specific overhead
            format_overhead = self._get_format_overhead(config.format)
            total_size = int(base_size * format_overhead)
            
            # Add packaging overhead for batch exports
            if len(config.item_ids) > 1:
                # README, manifest, and ZIP overhead
                total_size += 10240  # 10 KB for documentation
                total_size = int(total_size * 1.05)  # 5% ZIP compression overhead
            
            return total_size
        
        except Exception as e:
            current_app.logger.error(f"Size estimation failed: {e}")
            raise
    
    def _estimate_metadata_size(self, include_fields: 'IncludeFields') -> int:
        """
        Estimate metadata size per item based on included fields.
        
        Args:
            include_fields: Field inclusion configuration.
            
        Returns:
            Estimated size in bytes per item.
        """
        size = 0
        
        # Base fields (ID, always included)
        size += 50  # bytes
        
        if include_fields.basic_info:
            # Name, designation, etc.
            size += 200  # bytes
        
        if include_fields.classification:
            # Taxonomic classes
            size += 100  # bytes
        
        if include_fields.orbital_params:
            # 6-8 orbital parameters, ~8 bytes each
            size += 64  # bytes
        
        if include_fields.physical_props:
            # Diameter, albedo, rotation, density
            size += 64  # bytes
        
        return size
    
    def _estimate_spectral_size(self, spectral_options: 'SpectralOptions') -> int:
        """
        Estimate spectral data size per item.
        
        Args:
            spectral_options: Spectral data options.
            
        Returns:
            Estimated size in bytes per item.
        """
        # Estimate number of wavelength points
        if spectral_options.wavelength_range:
            min_wl, max_wl = spectral_options.wavelength_range
            # Assume ~0.01 micron resolution
            num_points = int((max_wl - min_wl) / 0.01)
        else:
            # Full spectrum: typically 0.45 to 2.45 microns
            num_points = 500
        
        # Each float is 8 bytes
        bytes_per_point = 8
        
        # Wavelengths + reflectance
        size = num_points * bytes_per_point * 2
        
        # Add uncertainty if included
        if spectral_options.include_uncertainty:
            size += num_points * bytes_per_point
        
        # Add metadata overhead if included
        if spectral_options.include_metadata:
            size += 200  # bytes for observation metadata
        
        return size
    
    def _get_format_overhead(self, format: str) -> float:
        """
        Get format-specific overhead multiplier.
        
        Args:
            format: Export format.
            
        Returns:
            Overhead multiplier.
        """
        overhead = {
            'csv': 1.3,   # CSV has text representation overhead
            'json': 1.6,  # JSON has structure and text overhead
            'hdf5': 1.1,  # HDF5 is binary and efficient
            'fits': 1.15  # FITS has header but efficient binary
        }
        return overhead.get(format, 1.2)
    
    def preview_export(
        self,
        config: ExportConfig
    ) -> Dict[str, Any]:
        """
        Generate preview of export structure.
        
        Args:
            config: Export configuration.
            
        Returns:
            Dictionary containing preview information including:
            - format: Export format
            - structure: Data structure details (columns, row counts)
            - sample_data: Sample rows from the export
            - spectral_info: Information about spectral data (if included)
            - estimated_size_bytes: Estimated file size in bytes
            - estimated_size_human: Human-readable file size
        """
        # Validate configuration
        config.validate()
        
        try:
            # Get sample data (first few items for preview)
            sample_size = min(5, len(config.item_ids))
            sample_ids = config.item_ids[:sample_size]
            
            # Retrieve sample metadata
            if config.data_type == 'asteroids':
                data = self.data_retrieval.get_asteroid_data(
                    sample_ids,
                    config.include_fields,
                    None  # Don't retrieve spectral data for preview
                )
            else:
                data = self.data_retrieval.get_meteorite_data(
                    sample_ids,
                    config.include_fields,
                    None  # Don't retrieve spectral data for preview
                )
            
            # Build preview structure
            preview = {
                'format': config.format,
                'data_type': config.data_type,
                'total_items': len(config.item_ids),
                'structure': {
                    'metadata_columns': list(data.columns) if not data.empty else [],
                    'metadata_column_count': len(data.columns) if not data.empty else 0,
                    'total_row_count': len(config.item_ids),
                    'sample_row_count': len(data)
                }
            }
            
            # Add sample data (first 3 rows)
            if not data.empty:
                sample_rows = data.head(3).to_dict('records')
                # Convert any NaN values to None for JSON serialization
                for row in sample_rows:
                    for key, value in row.items():
                        if pd.isna(value):
                            row[key] = None
                preview['sample_data'] = sample_rows
            else:
                preview['sample_data'] = []
            
            # Add spectral data information if included
            if config.include_fields.spectral_data and config.spectral_options:
                spectral_info = self._generate_spectral_preview(
                    sample_ids,
                    config.data_type,
                    config.spectral_options
                )
                preview['spectral_info'] = spectral_info
            
            # Add field inclusion summary
            preview['included_fields'] = {
                'basic_info': config.include_fields.basic_info,
                'classification': config.include_fields.classification,
                'orbital_params': config.include_fields.orbital_params,
                'physical_props': config.include_fields.physical_props,
                'spectral_data': config.include_fields.spectral_data
            }
            
            # Add estimated size
            estimated_size = self.estimate_size(config)
            preview['estimated_size_bytes'] = estimated_size
            preview['estimated_size_human'] = self._format_size(estimated_size)
            
            # Add export type (single or batch)
            preview['export_type'] = 'batch' if len(config.item_ids) > 1 else 'single'
            
            return preview
        
        except Exception as e:
            current_app.logger.error(f"Preview generation failed: {e}")
            raise
    
    def _generate_spectral_preview(
        self,
        sample_ids: List[str],
        data_type: str,
        spectral_options: 'SpectralOptions'
    ) -> Dict[str, Any]:
        """
        Generate preview information for spectral data.
        
        Args:
            sample_ids: Sample item IDs.
            data_type: Type of data.
            spectral_options: Spectral data options.
            
        Returns:
            Dictionary with spectral data preview information.
        """
        try:
            # Get spectral data for one sample item
            spectral_data = self.data_retrieval.get_spectral_data(
                sample_ids[:1],
                data_type,
                spectral_options
            )
            
            spectral_info = {
                'has_spectral_data': len(spectral_data.get('item_ids', [])) > 0,
                'wavelength_count': len(spectral_data.get('wavelengths', [])),
                'includes_uncertainty': spectral_data.get('uncertainty') is not None,
                'includes_metadata': spectral_data.get('metadata') is not None
            }
            
            # Add wavelength range if available
            if len(spectral_data.get('wavelengths', [])) > 0:
                wavelengths = spectral_data['wavelengths']
                spectral_info['wavelength_range'] = {
                    'min': float(wavelengths.min()),
                    'max': float(wavelengths.max()),
                    'unit': 'micrometers'
                }
            
            # Add sample wavelength values (first 5)
            if len(spectral_data.get('wavelengths', [])) > 0:
                sample_wavelengths = spectral_data['wavelengths'][:5].tolist()
                spectral_info['sample_wavelengths'] = [float(w) for w in sample_wavelengths]
            
            return spectral_info
        
        except Exception as e:
            current_app.logger.warning(f"Failed to generate spectral preview: {e}")
            return {
                'has_spectral_data': False,
                'error': 'Unable to preview spectral data'
            }
    
    def _create_single_export(
        self,
        config: ExportConfig,
        data: pd.DataFrame,
        spectral_data: Optional[Dict[str, np.ndarray]]
    ) -> ExportResult:
        """
        Create single file export.
        
        Args:
            config: Export configuration.
            data: DataFrame containing object data.
            spectral_data: Optional spectral data arrays.
            
        Returns:
            ExportResult with file content.
        """
        try:
            # Get appropriate format converter
            converter = self.converter_factory.get_converter(config.format)
            
            # Prepare export metadata
            export_metadata = {
                'export_date': datetime.utcnow().isoformat() + 'Z',
                'data_type': config.data_type,
                'item_count': len(config.item_ids),
                'format': config.format,
                'version': '1.0',
                'source': 'Asteroid Spectral Database'
            }
            
            # Convert data to target format
            content = converter.convert(data, spectral_data, export_metadata)
            
            # Check if converter returned a ZIP file (for CSV with spectral data)
            is_zip = content[:4] == b'PK\x03\x04' if len(content) >= 4 else False
            
            # Generate filename using naming convention
            item_id = self._sanitize_filename(config.item_ids[0])
            timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
            
            if is_zip:
                # Converter returned ZIP, use .zip extension
                extension = 'zip'
                mime_type = 'application/zip'
                current_app.logger.info("Single export: Converter returned ZIP package")
            else:
                # Use converter's default extension and MIME type
                extension = converter.get_file_extension()
                mime_type = converter.get_mime_type()
            
            filename = f"{config.data_type}_{item_id}_{timestamp}.{extension}"
            
            return ExportResult(
                content=content,
                filename=filename,
                mime_type=mime_type,
                size_bytes=len(content),
                item_count=len(config.item_ids),
                format=config.format
            )
        
        except Exception as e:
            current_app.logger.error(f"Single export creation failed: {e}")
            raise
    
    def _create_batch_export(
        self,
        config: ExportConfig,
        data: pd.DataFrame,
        spectral_data: Optional[Dict[str, np.ndarray]]
    ) -> ExportResult:
        """
        Create batch export with ZIP packaging and memory optimization.
        
        For large exports (>100 items), processes data in batches to reduce
        memory usage.
        
        Args:
            config: Export configuration.
            data: DataFrame containing object data.
            spectral_data: Optional spectral data arrays.
            
        Returns:
            ExportResult with ZIP archive content.
        """
        try:
            # Determine if we need batch processing for memory optimization
            use_batch_processing = len(config.item_ids) > 100
            
            if use_batch_processing:
                current_app.logger.info(f"Using batch processing for {len(config.item_ids)} items")
                return self._create_batch_export_optimized(config, data, spectral_data)
            
            files = {}
            
            # Get appropriate format converter
            converter = self.converter_factory.get_converter(config.format)
            
            # Prepare export metadata
            export_metadata = {
                'export_date': datetime.utcnow().isoformat() + 'Z',
                'data_type': config.data_type,
                'item_count': len(config.item_ids),
                'format': config.format,
                'version': '1.0',
                'source': 'Asteroid Spectral Database'
            }
            
            # Convert data to target format
            data_content = converter.convert(data, spectral_data, export_metadata)
            extension = converter.get_file_extension()
            
            # Check if converter already returned a ZIP (e.g., CSV with spectral data)
            is_already_zip = isinstance(data_content, bytes) and data_content[:4] == b'PK\x03\x04'
            
            if is_already_zip:
                # Converter already created a complete package, return it directly
                current_app.logger.info("Converter returned ZIP package, using it directly")
                
                # Generate filename for the ZIP
                timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
                if len(config.item_ids) == 1:
                    filename = f"{config.data_type}_{config.item_ids[0]}_{timestamp}.zip"
                else:
                    filename = f"{config.data_type}_batch_{len(config.item_ids)}items_{timestamp}.zip"
                
                return ExportResult(
                    content=data_content,
                    filename=filename,
                    mime_type='application/zip',
                    size_bytes=len(data_content),
                    item_count=len(config.item_ids),
                    format=config.format
                )
            
            # Add main data file(s) to package
            # For CSV format, converter may return multiple files
            if config.format == 'csv' and isinstance(data_content, dict):
                # CSV converter returns dict of multiple files
                for filename, content in data_content.items():
                    files[filename] = content
            else:
                # Single file for other formats
                if config.format == 'csv':
                    # For CSV, use consistent naming
                    files['data.csv'] = data_content
                else:
                    files[f'export_data.{extension}'] = data_content
            
            # Generate README
            readme_content = self.packaging.generate_readme(
                config.data_type,
                len(config.item_ids),
                config.format,
                {
                    'include_fields': config.include_fields.__dict__,
                    'spectral_options': config.spectral_options.__dict__ if config.spectral_options else None
                }
            )
            files['README.md'] = readme_content.encode('utf-8')
            
            # Generate manifest with item details
            items = []
            for item_id in config.item_ids:
                item_info = {'id': item_id}
                # Add name if available in data
                if not data.empty and 'id' in data.columns:
                    item_row = data[data['id'].astype(str) == str(item_id)]
                    if not item_row.empty:
                        # Add name field if available
                        if 'proper_name' in data.columns and pd.notna(item_row.iloc[0]['proper_name']):
                            item_info['name'] = item_row.iloc[0]['proper_name']
                        elif 'specimen_name' in data.columns and pd.notna(item_row.iloc[0]['specimen_name']):
                            item_info['name'] = item_row.iloc[0]['specimen_name']
                items.append(item_info)
            
            manifest = self.packaging.generate_manifest(
                items,
                {
                    'data_type': config.data_type,
                    'format': config.format,
                    'item_count': len(config.item_ids),
                    'include_fields': config.include_fields.__dict__,
                    'spectral_options': config.spectral_options.__dict__ if config.spectral_options else None
                }
            )
            
            # Create ZIP package
            zip_content = self.packaging.create_package(files, manifest)
            
            # Generate filename using naming convention
            timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
            filename = f"{config.data_type}_batch_{len(config.item_ids)}items_{timestamp}.zip"
            
            return ExportResult(
                content=zip_content,
                filename=filename,
                mime_type='application/zip',
                size_bytes=len(zip_content),
                item_count=len(config.item_ids),
                format=config.format
            )
        
        except Exception as e:
            current_app.logger.error(f"Batch export creation failed: {e}")
            raise
    
    def _create_batch_export_optimized(
        self,
        config: ExportConfig,
        data: pd.DataFrame,
        spectral_data: Optional[Dict[str, np.ndarray]]
    ) -> ExportResult:
        """
        Create batch export with memory optimization for large datasets.
        
        Processes data in chunks to reduce memory footprint.
        
        Args:
            config: Export configuration.
            data: DataFrame containing object data.
            spectral_data: Optional spectral data arrays.
            
        Returns:
            ExportResult with ZIP archive content.
        """
        import io
        import zipfile
        
        # Get appropriate format converter
        converter = self.converter_factory.get_converter(config.format)
        
        # Prepare export metadata
        export_metadata = {
            'export_date': datetime.utcnow().isoformat() + 'Z',
            'data_type': config.data_type,
            'item_count': len(config.item_ids),
            'format': config.format,
            'version': '1.0',
            'source': 'Asteroid Spectral Database'
        }
        
        # Convert data to target format
        self._report_progress(60, "Converting data to target format...")
        data_content = converter.convert(data, spectral_data, export_metadata)
        extension = converter.get_file_extension()
        
        # Check if converter already returned a ZIP (e.g., CSV with spectral data)
        is_already_zip = isinstance(data_content, bytes) and data_content[:4] == b'PK\x03\x04'
        
        if is_already_zip:
            # Converter already created a complete package, return it directly
            current_app.logger.info("Converter returned ZIP package, using it directly")
            
            # Generate filename for the ZIP
            timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
            if len(config.item_ids) == 1:
                filename = f"{config.data_type}_{config.item_ids[0]}_{timestamp}.zip"
            else:
                filename = f"{config.data_type}_batch_{len(config.item_ids)}items_{timestamp}.zip"
            
            return ExportResult(
                content=data_content,
                filename=filename,
                mime_type='application/zip',
                size_bytes=len(data_content),
                item_count=len(config.item_ids),
                format=config.format
            )
        
        # Create in-memory ZIP file with streaming
        zip_buffer = io.BytesIO()
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as zip_file:
            
            # Add main data file(s) to ZIP
            self._report_progress(70, "Creating archive...")
            if config.format == 'csv' and isinstance(data_content, dict):
                for filename, content in data_content.items():
                    zip_file.writestr(filename, content)
                    current_app.logger.debug(f"Added {filename} to archive")
            else:
                if config.format == 'csv':
                    zip_file.writestr('data.csv', data_content)
                    current_app.logger.debug(f"Added data.csv to archive")
                else:
                    zip_file.writestr(f'export_data.{extension}', data_content)
                    current_app.logger.debug(f"Added export_data.{extension} to archive")
            
            # Clear data_content to free memory
            del data_content
            
            # Generate and add README
            self._report_progress(80, "Generating documentation...")
            readme_content = self.packaging.generate_readme(
                config.data_type,
                len(config.item_ids),
                config.format,
                {
                    'include_fields': config.include_fields.__dict__,
                    'spectral_options': config.spectral_options.__dict__ if config.spectral_options else None
                }
            )
            zip_file.writestr('README.md', readme_content.encode('utf-8'))
            
            # Generate manifest with item details (process in chunks)
            self._report_progress(90, "Generating manifest...")
            items = []
            chunk_size = 100
            
            for i in range(0, len(config.item_ids), chunk_size):
                chunk_ids = config.item_ids[i:i + chunk_size]
                
                for item_id in chunk_ids:
                    item_info = {'id': item_id}
                    # Add name if available in data
                    if not data.empty and 'id' in data.columns:
                        item_row = data[data['id'].astype(str) == str(item_id)]
                        if not item_row.empty:
                            if 'proper_name' in data.columns and pd.notna(item_row.iloc[0]['proper_name']):
                                item_info['name'] = item_row.iloc[0]['proper_name']
                            elif 'specimen_name' in data.columns and pd.notna(item_row.iloc[0]['specimen_name']):
                                item_info['name'] = item_row.iloc[0]['specimen_name']
                    items.append(item_info)
            
            manifest = self.packaging.generate_manifest(
                items,
                {
                    'data_type': config.data_type,
                    'format': config.format,
                    'item_count': len(config.item_ids),
                    'include_fields': config.include_fields.__dict__,
                    'spectral_options': config.spectral_options.__dict__ if config.spectral_options else None
                }
            )
            
            # Add manifest to ZIP
            import json
            manifest_json = json.dumps(manifest, indent=2, default=str)
            zip_file.writestr('manifest.json', manifest_json)
            
            current_app.logger.info("ZIP archive creation complete")
        
        # Get ZIP content
        zip_buffer.seek(0)
        zip_content = zip_buffer.getvalue()
        
        # Generate filename
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        filename = f"{config.data_type}_batch_{len(config.item_ids)}items_{timestamp}.zip"
        
        return ExportResult(
            content=zip_content,
            filename=filename,
            mime_type='application/zip',
            size_bytes=len(zip_content),
            item_count=len(config.item_ids),
            format=config.format
        )
    
    def _sanitize_filename(self, name: str) -> str:
        """
        Sanitize object name for use in filename.
        
        Removes special characters that may cause file system issues.
        
        Args:
            name: Original name/identifier.
            
        Returns:
            Sanitized name safe for filenames.
        """
        import re
        # Replace spaces and special characters with underscores
        sanitized = re.sub(r'[^\w\-.]', '_', str(name))
        # Remove consecutive underscores
        sanitized = re.sub(r'_+', '_', sanitized)
        # Remove leading/trailing underscores
        sanitized = sanitized.strip('_')
        return sanitized
    
    def _format_size(self, size_bytes: int) -> str:
        """
        Format size in bytes to human-readable string.
        
        Args:
            size_bytes: Size in bytes.
            
        Returns:
            Human-readable size string.
        """
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size_bytes < 1024.0:
                return f"{size_bytes:.2f} {unit}"
            size_bytes /= 1024.0
        return f"{size_bytes:.2f} TB"
