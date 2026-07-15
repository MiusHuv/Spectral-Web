import { describe, expect, it } from 'vitest';
import { resolveExportItemIds, resolveExportObservationIds } from '../ExportModal';

describe('resolveExportItemIds', () => {
  it('uses numeric asteroid IDs from cart entries', () => {
    expect(resolveExportItemIds(
      ['asteroid-12', 'observation-99'],
      [
        { id: 'asteroid-12', type: 'asteroid', name: 'A', classification: 'C', asteroidId: 12, addedAt: 1 },
        { id: 'observation-99', type: 'asteroid', name: 'B', classification: 'S', asteroidId: 27, addedAt: 1 },
      ],
      'asteroids'
    )).toEqual(['12', '27']);
  });

  it('preserves explicitly selected observation IDs for raw file export', () => {
    expect(resolveExportObservationIds(
      ['observation-99', 'asteroid-12'],
      [
        { id: 'observation-99', type: 'asteroid', name: 'B', classification: 'S', asteroidId: 27, observationId: 99, addedAt: 1 },
        { id: 'asteroid-12', type: 'asteroid', name: 'A', classification: 'C', asteroidId: 12, addedAt: 1 },
      ],
      'asteroids'
    )).toEqual(['99']);
  });

  it('uses numeric meteorite IDs and preserves result-table IDs', () => {
    expect(resolveExportItemIds(
      ['meteorite-8', '14'],
      [{ id: 'meteorite-8', type: 'meteorite', name: 'M', classification: 'OC', meteoriteId: 8, addedAt: 1 }],
      'meteorites'
    )).toEqual(['8', '14']);
  });
});
