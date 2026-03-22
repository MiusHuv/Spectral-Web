import { describe, it, expect, beforeEach } from 'vitest';
import {
    addExportToHistory,
    getExportHistory,
    clearExportHistory,
    removeExportFromHistory,
    formatFileSize,
    formatTimestamp,
    ExportHistoryEntry
} from '../exportHistory';

describe('exportHistory', () => {
    beforeEach(() => {
        // Clear localStorage before each test
        localStorage.clear();
    });

    describe('addExportToHistory', () => {
        it('should add an export to history', () => {
            const entry = {
                timestamp: '2024-01-15T10:30:00.000Z',
                itemCount: 5,
                format: 'csv' as const,
                dataType: 'asteroids' as const,
                fileSizeBytes: 1024,
                fileSizeHuman: '1.00 KB',
                itemIds: ['ast_1', 'ast_2', 'ast_3', 'ast_4', 'ast_5'],
                includeFields: {
                    basicInfo: true,
                    classification: true,
                    orbitalParams: true,
                    physicalProps: true,
                    spectralData: true,
                },
            };

            addExportToHistory(entry);

            const history = getExportHistory();
            expect(history).toHaveLength(1);
            expect(history[0]).toMatchObject(entry);
            expect(history[0].id).toBeTruthy();
        });

        it('should add multiple exports to history', () => {
            const entry1 = {
                timestamp: '2024-01-15T10:30:00.000Z',
                itemCount: 5,
                format: 'csv' as const,
                dataType: 'asteroids' as const,
                fileSizeBytes: 1024,
                fileSizeHuman: '1.00 KB',
                itemIds: ['ast_1'],
                includeFields: {
                    basicInfo: true,
                    classification: true,
                    orbitalParams: true,
                    physicalProps: true,
                    spectralData: true,
                },
            };

            const entry2 = {
                timestamp: '2024-01-15T11:30:00.000Z',
                itemCount: 10,
                format: 'json' as const,
                dataType: 'meteorites' as const,
                fileSizeBytes: 2048,
                fileSizeHuman: '2.00 KB',
                itemIds: ['met_1'],
                includeFields: {
                    basicInfo: true,
                    classification: false,
                    orbitalParams: false,
                    physicalProps: true,
                    spectralData: false,
                },
            };

            addExportToHistory(entry1);
            addExportToHistory(entry2);

            const history = getExportHistory();
            expect(history).toHaveLength(2);
            // Most recent should be first
            expect(history[0]).toMatchObject(entry2);
            expect(history[1]).toMatchObject(entry1);
        });

        it('should limit history to 10 entries', () => {
            // Add 15 entries
            for (let i = 0; i < 15; i++) {
                addExportToHistory({
                    timestamp: new Date().toISOString(),
                    itemCount: i + 1,
                    format: 'csv',
                    dataType: 'asteroids',
                    fileSizeBytes: 1024 * (i + 1),
                    fileSizeHuman: `${i + 1}.00 KB`,
                    itemIds: [`ast_${i}`],
                    includeFields: {
                        basicInfo: true,
                        classification: true,
                        orbitalParams: true,
                        physicalProps: true,
                        spectralData: true,
                    },
                });
            }

            const history = getExportHistory();
            expect(history).toHaveLength(10);
            // Should keep the most recent 10
            expect(history[0].itemCount).toBe(15);
            expect(history[9].itemCount).toBe(6);
        });
    });

    describe('getExportHistory', () => {
        it('should return empty array when no history exists', () => {
            const history = getExportHistory();
            expect(history).toEqual([]);
        });

        it('should return saved history', () => {
            const entry = {
                timestamp: '2024-01-15T10:30:00.000Z',
                itemCount: 5,
                format: 'csv' as const,
                dataType: 'asteroids' as const,
                fileSizeBytes: 1024,
                fileSizeHuman: '1.00 KB',
                itemIds: ['ast_1'],
                includeFields: {
                    basicInfo: true,
                    classification: true,
                    orbitalParams: true,
                    physicalProps: true,
                    spectralData: true,
                },
            };

            addExportToHistory(entry);
            const history = getExportHistory();

            expect(history).toHaveLength(1);
            expect(history[0]).toMatchObject(entry);
        });

        it('should handle corrupted localStorage data', () => {
            localStorage.setItem('asteroid_spectral_export_history', 'invalid json');
            const history = getExportHistory();
            expect(history).toEqual([]);
        });

        it('should filter out invalid entries', () => {
            const validEntry = {
                id: 'test_1',
                timestamp: '2024-01-15T10:30:00.000Z',
                itemCount: 5,
                format: 'csv',
                dataType: 'asteroids',
                fileSizeBytes: 1024,
                fileSizeHuman: '1.00 KB',
                itemIds: ['ast_1'],
                includeFields: {
                    basicInfo: true,
                    classification: true,
                    orbitalParams: true,
                    physicalProps: true,
                    spectralData: true,
                },
            };

            const invalidEntry = {
                id: 'test_2',
                // Missing required fields
                timestamp: '2024-01-15T10:30:00.000Z',
            };

            localStorage.setItem(
                'asteroid_spectral_export_history',
                JSON.stringify([validEntry, invalidEntry])
            );

            const history = getExportHistory();
            expect(history).toHaveLength(1);
            expect(history[0].id).toBe('test_1');
        });
    });

    describe('clearExportHistory', () => {
        it('should clear all history', () => {
            addExportToHistory({
                timestamp: '2024-01-15T10:30:00.000Z',
                itemCount: 5,
                format: 'csv',
                dataType: 'asteroids',
                fileSizeBytes: 1024,
                fileSizeHuman: '1.00 KB',
                itemIds: ['ast_1'],
                includeFields: {
                    basicInfo: true,
                    classification: true,
                    orbitalParams: true,
                    physicalProps: true,
                    spectralData: true,
                },
            });

            expect(getExportHistory()).toHaveLength(1);

            clearExportHistory();

            expect(getExportHistory()).toHaveLength(0);
        });
    });

    describe('removeExportFromHistory', () => {
        it('should remove a specific entry', () => {
            addExportToHistory({
                timestamp: '2024-01-15T10:30:00.000Z',
                itemCount: 5,
                format: 'csv',
                dataType: 'asteroids',
                fileSizeBytes: 1024,
                fileSizeHuman: '1.00 KB',
                itemIds: ['ast_1'],
                includeFields: {
                    basicInfo: true,
                    classification: true,
                    orbitalParams: true,
                    physicalProps: true,
                    spectralData: true,
                },
            });

            addExportToHistory({
                timestamp: '2024-01-15T11:30:00.000Z',
                itemCount: 10,
                format: 'json',
                dataType: 'meteorites',
                fileSizeBytes: 2048,
                fileSizeHuman: '2.00 KB',
                itemIds: ['met_1'],
                includeFields: {
                    basicInfo: true,
                    classification: true,
                    orbitalParams: true,
                    physicalProps: true,
                    spectralData: true,
                },
            });

            const history = getExportHistory();
            expect(history).toHaveLength(2);

            const idToRemove = history[0].id;
            removeExportFromHistory(idToRemove);

            const updatedHistory = getExportHistory();
            expect(updatedHistory).toHaveLength(1);
            expect(updatedHistory[0].id).not.toBe(idToRemove);
        });
    });

    describe('formatFileSize', () => {
        it('should format bytes correctly', () => {
            expect(formatFileSize(0)).toBe('0 B');
            expect(formatFileSize(500)).toBe('500.00 B');
            expect(formatFileSize(1024)).toBe('1.00 KB');
            expect(formatFileSize(1536)).toBe('1.50 KB');
            expect(formatFileSize(1048576)).toBe('1.00 MB');
            expect(formatFileSize(1572864)).toBe('1.50 MB');
            expect(formatFileSize(1073741824)).toBe('1.00 GB');
        });
    });

    describe('formatTimestamp', () => {
        it('should format today timestamps', () => {
            const now = new Date();
            const timestamp = now.toISOString();
            const formatted = formatTimestamp(timestamp);
            expect(formatted).toContain('Today at');
        });

        it('should format yesterday timestamps', () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const timestamp = yesterday.toISOString();
            const formatted = formatTimestamp(timestamp);
            expect(formatted).toContain('Yesterday at');
        });

        it('should format older timestamps with full date', () => {
            const oldDate = new Date('2024-01-15T10:30:00.000Z');
            const formatted = formatTimestamp(oldDate.toISOString());
            expect(formatted).toContain('Jan');
            expect(formatted).toContain('15');
        });

        it('should handle invalid timestamps gracefully', () => {
            const invalidTimestamp = 'invalid-date';
            const formatted = formatTimestamp(invalidTimestamp);
            expect(formatted).toBe(invalidTimestamp);
        });
    });
});
