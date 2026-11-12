import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SlotsConfigSchema } from './slot-schema';

const require = createRequire(import.meta.url);
const validateManifest = require('../../../../scripts/validate-manifest.js') as (path: string) => boolean;

describe('manifest AI context validation', () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'chart-context-'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  function validate(manifest: unknown): boolean {
    const path = join(directory, 'manifest.json');
    writeFileSync(path, JSON.stringify(manifest));
    return validateManifest(path);
  }

  it('accepts existing manifests without context', () => {
    expect(validate({ slots: [{ name: 'measure' }] })).toBe(true);
  });

  it('accepts chart descriptions, aliases and slot descriptions', () => {
    expect(validate({
      context: { description: 'Compare categories', synonyms: ['horizontal bar'] },
      slots: [{ name: 'measure', context: { description: 'Bar length' } }]
    })).toBe(true);
    expect(validate({ context: { description: 'Compare categories' }, slots: [] })).toBe(true);
  });

  it.each([null, 'text', {}, { description: 1 }, { description: 'text', synonyms: 'bar' }, { description: 'text', synonyms: [1] }])(
    'rejects invalid chart context %j', (context) => {
      expect(validate({ context, slots: [] })).toBe(false);
    }
  );

  it.each([null, 'text', {}, { description: false }])('rejects invalid slot context %j', (context) => {
    expect(validate({ slots: [{ name: 'measure', context }] })).toBe(false);
  });

  it('preserves context while normalizing legacy slot properties', () => {
    const [slot] = SlotsConfigSchema.parse([{
      name: 'measure',
      acceptableColumnTypes: ['numeric'],
      context: { description: 'Bar length' }
    }]);
    expect(slot).toMatchObject({
      acceptableDataFieldTypes: ['numeric'],
      context: { description: 'Bar length' }
    });
  });
});
