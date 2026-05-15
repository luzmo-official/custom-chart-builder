import {
  isDataResponse,
  isErrorResponse,
  normalizeQueryDataForRender,
  normalizeQueryResponse,
  type ItemData,
  type ItemErrorResponse
} from './types';

const createDataResponse = (overrides: Partial<ItemData> = {}): ItemData => ({
  cached: false,
  data: [[1]],
  query_id: 'query-1',
  performance: {
    preparing: 0,
    processing: 0,
    querying: 0,
    queuing: 0,
    validating: 0
  },
  ...overrides
});

const createErrorResponse = (message = 'boom'): ItemErrorResponse => ({
  error: {
    message,
    type: { code: 500, description: 'internal' }
  }
});

describe('normalizeQueryResponse', () => {
  it('wraps a single ItemData object into a one-element array (1-query backend response)', () => {
    const single = createDataResponse();

    const result = normalizeQueryResponse(single);

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(single);
  });

  it('wraps a single ItemErrorResponse object into a one-element array', () => {
    const error = createErrorResponse();

    const result = normalizeQueryResponse(error);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(error);
  });

  it('returns an N-element array unchanged (N-query backend response)', () => {
    const responses = [createDataResponse({ query_id: 'q1' }), createDataResponse({ query_id: 'q2' })];

    const result = normalizeQueryResponse(responses);

    expect(result).toBe(responses);
    expect(result).toHaveLength(2);
  });

  it('preserves a mix of data and error responses inside the same array', () => {
    const responses = [createDataResponse(), createErrorResponse('failed q2')];

    const result = normalizeQueryResponse(responses);

    expect(result).toHaveLength(2);
    expect(isDataResponse(result[0])).toBe(true);
    expect(isErrorResponse(result[1])).toBe(true);
  });
});

describe('normalizeQueryDataForRender', () => {
  it('returns flat rows for a single-query response', () => {
    const rows = [
      ['2024-01-01T00:00:00.000Z', 4421921],
      ['2024-02-01T00:00:00.000Z', 123]
    ];

    const result = normalizeQueryDataForRender([createDataResponse({ data: rows })]);

    expect(result).toBe(rows);
  });

  it('preserves one row array per query for multi-query responses', () => {
    const cohortRows = [
      ['2024-01-01T00:00:00.000Z', 4421921],
      ['2024-02-01T00:00:00.000Z', 3900000]
    ];
    const matrixRows = [
      ['2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z', 401391],
      ['2024-01-01T00:00:00.000Z', '2024-02-01T00:00:00.000Z', 38112]
    ];

    const result = normalizeQueryDataForRender([
      createDataResponse({ data: cohortRows, query_id: 'cohort-sizes' }),
      createDataResponse({ data: matrixRows, query_id: 'cohort-matrix' })
    ]);

    expect(result).toEqual([cohortRows, matrixRows]);
  });
});

describe('isErrorResponse', () => {
  it('returns true for objects with a defined error field', () => {
    expect(isErrorResponse(createErrorResponse())).toBe(true);
  });

  it('returns false for data responses', () => {
    expect(isErrorResponse(createDataResponse())).toBe(false);
  });
});

describe('isDataResponse', () => {
  it('returns true for objects with a data field and no error field', () => {
    expect(isDataResponse(createDataResponse())).toBe(true);
  });

  it('returns false for error responses', () => {
    expect(isDataResponse(createErrorResponse())).toBe(false);
  });
});
