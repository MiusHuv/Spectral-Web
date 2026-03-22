import { describe, it, expect, beforeEach } from 'vitest';
import {
    saveExportPreferences,
    loadExportPreferences,
    clearExportPreferences,
    getDefaultPreferences,
    ExportPreferences
} from '../exportPreferences';

describe('exportPreferences', () => {
    beforeEach(() => {
        // Clear localStorage before each test
        localStorage.clear();
    });

    describe('saveExportPreferences', () => {
        it('should save preferences to localStorage', () => {
            const preferences: ExportPreferences = {
                format: 'json',
                includeFields: {
                    basicInfo: true,
                    classification: false,
                    orbitalParams: true,
                    physicalProps: false,
                    spectralData: true,
                },
                spectralOptions: {
                    resolution: 'resampled',
                    includeUncertainty: false,
                    includeMetadata: true,
                },
            };

            saveExportPreferences(preferences);

            const saved = localStorage.getItem('asteroid_spectral_export_preferences');
            expect(saved).toBeTruthy();
            expect(JSON.parse(saved!)).toEqual(preferences);
        });
    });

    describe('loadExportPreferences', () => {
        it('should load saved preferences from localStorage', () => {
            const preferences: ExportPreferences = {
                format: 'hdf5',
                includeFields: {
                    basicInfo: true,
                    classification: true,
                    orbitalParams: false,
                    physicalProps: true,
                    spectralData: false,
                },
                spectralOptions: {
                    resolution: 'original',
                    includeUncertainty: true,
                    includeMetadata: false,
                },
            };

            saveExportPreferences(preferences);
            const loaded = loadExportPreferences();

            expect(loaded).toEqual(preferences);
        });

        it('should return null if no preferences are saved', () => {
            const loaded = loadExportPreferences();
            expect(loaded).toBeNull();
        });

        it('should return null if saved preferences are invalid', () => {
            localStorage.setItem('asteroid_spectral_export_preferences', 'invalid json');
            const loaded = loadExportPreferences();
            expect(loaded).toBeNull();
        });

        it('should validate preferences structure', () => {
            const invalidPreferences = {
                format: 'invalid_format',
                includeFields: {},
            };

            localStorage.setItem(
                'asteroid_spectral_export_preferences',
                JSON.stringify(invalidPreferences)
            );

            const loaded = loadExportPreferences();
            expect(loaded).toBeNull();
        });

        it('should handle wavelength range in spectral options', () => {
            const preferences: ExportPreferences = {
                format: 'csv',
                includeFields: {
                    basicInfo: true,
                    classification: true,
                    orbitalParams: true,
                    physicalProps: true,
                    spectralData: true,
                },
                spectralOptions: {
                    wavelengthRange: [0.45, 2.45],
                    resolution: 'original',
                    includeUncertainty: true,
                    includeMetadata: true,
                },
            };

            saveExportPreferences(preferences);
            const loaded = loadExportPreferences();

            expect(loaded).toEqual(preferences);
            expect(loaded?.spectralOptions.wavelengthRange).toEqual([0.45, 2.45]);
        });
    });

    describe('clearExportPreferences', () => {
        it('should remove preferences from localStorage', () => {
            const preferences = getDefaultPreferences();
            saveExportPreferences(preferences);

            expect(localStorage.getItem('asteroid_spectral_export_preferences')).toBeTruthy();

            clearExportPreferences();

            expect(localStorage.getItem('asteroid_spectral_export_preferences')).toBeNull();
        });
    });

    describe('getDefaultPreferences', () => {
        it('should return default preferences', () => {
            const defaults = getDefaultPreferences();

            expect(defaults.format).toBe('csv');
            expect(defaults.includeFields.basicInfo).toBe(true);
            expect(defaults.includeFields.classification).toBe(true);
            expect(defaults.includeFields.orbitalParams).toBe(true);
            expect(defaults.includeFields.physicalProps).toBe(true);
            expect(defaults.includeFields.spectralData).toBe(true);
            expect(defaults.spectralOptions.resolution).toBe('original');
            expect(defaults.spectralOptions.includeUncertainty).toBe(true);
            expect(defaults.spectralOptions.includeMetadata).toBe(true);
        });
    });
});
