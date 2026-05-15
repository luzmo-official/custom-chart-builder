import {
  IFRAME_SANDBOX_PERMISSIONS,
  normalizeBuildQueryResult
} from './iframe.utils';
import type { ItemQuery } from './types';

const buildQuery = (datasetId: string, columnId: string): ItemQuery => ({
  dimensions: [],
  measures: [{ dataset_id: datasetId, column_id: columnId }]
});

describe('normalizeBuildQueryResult', () => {
  it('returns null when raw is null', () => {
    expect(normalizeBuildQueryResult(null)).toBeNull();
  });

  it('returns null when raw is undefined', () => {
    expect(normalizeBuildQueryResult(undefined)).toBeNull();
  });

  it('wraps a single ItemQuery into a one-element array (legacy chart shape)', () => {
    const query = buildQuery('ds-1', 'col-revenue');

    const result = normalizeBuildQueryResult(query);

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result?.[0]).toBe(query);
  });

  it('returns a non-empty ItemQuery array unchanged (multi-query chart shape)', () => {
    const queries: ItemQuery[] = [
      buildQuery('ds-1', 'col-revenue'),
      buildQuery('ds-1', 'col-target')
    ];

    const result = normalizeBuildQueryResult(queries);

    expect(result).toBe(queries);
    expect(result).toHaveLength(2);
  });

  it('returns an empty array unchanged', () => {
    const queries: ItemQuery[] = [];

    const result = normalizeBuildQueryResult(queries);

    expect(result).toBe(queries);
    expect(result).toEqual([]);
  });
});

describe('IFRAME_SANDBOX_PERMISSIONS', () => {
  it('allows scripts and popups', () => {
    const permissions = IFRAME_SANDBOX_PERMISSIONS.split(' ');

    expect(permissions).toContain('allow-scripts');
    expect(permissions).toContain('allow-popups');
  });
});
