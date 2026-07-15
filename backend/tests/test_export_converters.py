import io
import json

import h5py
import numpy as np
import pandas as pd
from astropy.io import fits
from unittest.mock import Mock

from app.converters.fits_converter import FITSConverter
from app.converters.hdf5_converter import HDF5Converter
from app.converters.json_converter import JSONConverter
from app.services.data_retrieval_service import DataRetrievalService


def original_resolution_payload():
    return {
        'wavelengths': [np.array([0.45, 0.55]), np.array([0.46, 0.56, 0.66])],
        'reflectance': [np.array([0.9, 1.0]), np.array([0.8, 0.95, 1.1])],
        'uncertainty': None,
        'item_ids': ['7', '7'],
        'metadata': [
            {'observation_id': 101, 'data_source': 'first'},
            {'observation_id': 102, 'data_source': 'second'},
        ],
        'resolution': 'original',
    }


def object_frame():
    return pd.DataFrame([{'id': 7, 'proper_name': 'Test'}])


def test_json_supports_multiple_original_resolution_observations():
    content = JSONConverter().convert(object_frame(), original_resolution_payload())
    payload = json.loads(content)

    assert len(payload['objects'][0]['spectra']) == 2
    assert payload['objects'][0]['spectra'][1]['wavelengths'] == [0.46, 0.56, 0.66]


def test_hdf5_supports_ragged_original_resolution_observations():
    content = HDF5Converter().convert(object_frame(), original_resolution_payload())

    with h5py.File(io.BytesIO(content), 'r') as exported:
        assert list(exported['spectra/object_ids'].asstr()[:]) == ['7', '7']
        assert list(exported['spectra/wavelengths'][1]) == [0.46, 0.56, 0.66]


def test_fits_supports_ragged_original_resolution_observations():
    content = FITSConverter().convert(object_frame(), original_resolution_payload())

    with fits.open(io.BytesIO(content)) as exported:
        spectra = exported['SPECTRA'].data
        assert len(spectra) == 2
        assert list(spectra['WAVELENGTH'][1]) == [0.46, 0.56, 0.66]


def test_reconstructs_source_named_original_text_file():
    database = Mock()
    database.execute_query.return_value = pd.DataFrame([{
        'observation_id': 4269,
        'source_name': 'a000001.dm04.txt',
        'spectral_data': json.dumps({
            'wavelengths': [0.435, 0.4375],
            'reflectance': [0.9004, 0.9186],
            'uncertainty': [0.0149, 0.0128],
        }),
    }])
    service = DataRetrievalService(database)

    files = service.get_raw_spectral_files(['331'], 'asteroids', ['4269'])

    assert files == {
        'original_data/a000001.dm04.txt': (
            b'0.435\t0.9004\t0.0149\n0.4375\t0.9186\t0.0128\n'
        )
    }


def test_reconstructed_original_file_adds_txt_suffix_when_needed():
    database = Mock()
    database.execute_query.return_value = pd.DataFrame([{
        'observation_id': 12,
        'source_name': 'catalog-entry',
        'spectral_data': json.dumps({
            'wavelengths': [0.5],
            'reflectance': [1.0],
        }),
    }])
    service = DataRetrievalService(database)

    files = service.get_raw_spectral_files(['7'], 'asteroids')

    assert files == {'original_data/catalog-entry.txt': b'0.5\t1\n'}
