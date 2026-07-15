"""Normalize export spectral payloads into observation records."""

from collections.abc import Mapping
from typing import Any, Dict, List, Optional

import numpy as np


def _float_array(value: Any) -> np.ndarray:
    if value is None:
        return np.array([], dtype=float)
    return np.asarray(value, dtype=float).reshape(-1)


def _is_record_sequence(value: Any, expected_count: int) -> bool:
    if expected_count <= 0 or value is None:
        return False
    if isinstance(value, np.ndarray):
        return value.ndim > 1 and len(value) == expected_count
    if not isinstance(value, (list, tuple)) or len(value) != expected_count:
        return False
    return not value or not np.isscalar(value[0])


def _metadata_at(metadata: Any, index: int, object_id: str) -> Dict[str, Any]:
    if isinstance(metadata, Mapping):
        value = metadata.get(object_id, metadata.get(str(object_id), {}))
    elif isinstance(metadata, (list, tuple)) and index < len(metadata):
        value = metadata[index]
    else:
        value = {}
    return dict(value) if isinstance(value, Mapping) else {}


def _uncertainty_at(uncertainty: Any, index: int, object_id: str) -> Optional[np.ndarray]:
    if uncertainty is None:
        return None
    if isinstance(uncertainty, Mapping):
        value = uncertainty.get(object_id, uncertainty.get(str(object_id)))
    elif isinstance(uncertainty, np.ndarray) and uncertainty.ndim == 1:
        value = uncertainty if index == 0 else None
    elif isinstance(uncertainty, (list, tuple, np.ndarray)) and index < len(uncertainty):
        value = uncertainty[index]
    else:
        value = None
    return None if value is None else _float_array(value)


def spectral_records(spectral_data: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Return one normalized record per spectrum/observation."""
    if not spectral_data:
        return []

    reflectance = spectral_data.get('reflectance')
    if reflectance is None:
        return []

    wavelengths = spectral_data.get('wavelengths', [])
    uncertainty = spectral_data.get('uncertainty')
    metadata = spectral_data.get('metadata', spectral_data.get('observation_metadata', {}))
    records: List[Dict[str, Any]] = []

    if isinstance(reflectance, Mapping):
        entries = list(reflectance.items())
    else:
        array = np.asarray(reflectance, dtype=object)
        if array.ndim == 1 and (len(array) == 0 or np.isscalar(array[0])):
            values = [reflectance]
        else:
            values = list(reflectance)
        item_ids = list(spectral_data.get('item_ids', []))
        entries = [
            (str(item_ids[index]) if index < len(item_ids) else str(index), value)
            for index, value in enumerate(values)
        ]

    per_record_wavelengths = _is_record_sequence(wavelengths, len(entries))
    for index, (raw_object_id, values) in enumerate(entries):
        object_id = str(raw_object_id)
        reflectance_values = _float_array(values)
        if reflectance_values.size == 0:
            continue

        wavelength_values = _float_array(
            wavelengths[index] if per_record_wavelengths else wavelengths
        )
        point_count = min(len(wavelength_values), len(reflectance_values))
        if point_count == 0:
            continue

        uncertainty_values = _uncertainty_at(uncertainty, index, object_id)
        if uncertainty_values is not None:
            uncertainty_values = uncertainty_values[:point_count]

        records.append({
            'object_id': object_id,
            'wavelengths': wavelength_values[:point_count],
            'reflectance': reflectance_values[:point_count],
            'uncertainty': uncertainty_values,
            'metadata': _metadata_at(metadata, index, object_id),
        })

    return records


def has_spectral_records(spectral_data: Optional[Dict[str, Any]]) -> bool:
    return bool(spectral_records(spectral_data))
