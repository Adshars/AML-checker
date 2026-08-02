import { describe, it, expect } from 'vitest';
import { formatKey, getExtendedDetailsEntries } from '../utils/extendedDetailsMapper';

describe('formatKey', () => {
  it('formats camelCase keys as Title Case labels', () => {
    expect(formatKey('birthPlace')).toBe('Birth Place');
  });

  it('capitalizes single-word keys', () => {
    expect(formatKey('name')).toBe('Name');
  });
});

describe('getExtendedDetailsEntries', () => {
  it('returns an empty array for null/undefined/empty data', () => {
    expect(getExtendedDetailsEntries(null)).toEqual([]);
    expect(getExtendedDetailsEntries(undefined)).toEqual([]);
    expect(getExtendedDetailsEntries({})).toEqual([]);
  });

  it('orders priority fields before non-priority fields, in priority order', () => {
    const entries = getExtendedDetailsEntries({
      nationality: 'PL',
      name: 'Jan Kowalski',
      birthDate: '1980-01-01',
    });
    expect(entries.map(([key]) => key)).toEqual(['name', 'birthDate', 'nationality']);
  });

  it('sorts non-priority fields alphabetically after priority fields', () => {
    const entries = getExtendedDetailsEntries({
      zebra: 'z',
      name: 'Jan Kowalski',
      apple: 'a',
    });
    expect(entries.map(([key]) => key)).toEqual(['name', 'apple', 'zebra']);
  });

  it('filters out technical/ignored fields such as schema and datasets', () => {
    const entries = getExtendedDetailsEntries({
      name: 'Jan Kowalski',
      schema: 'Person',
      datasets: ['ofac'],
    });
    expect(entries.map(([key]) => key)).toEqual(['name']);
  });

  it('omits fields whose value is an empty array', () => {
    const entries = getExtendedDetailsEntries({ name: 'Jan Kowalski', weakAlias: [] });
    expect(entries.map(([key]) => key)).toEqual(['name']);
  });

  it('keeps array values intact for the caller to render', () => {
    const entries = getExtendedDetailsEntries({ alias: ['Johnny', 'JK'] });
    expect(entries).toEqual([['alias', ['Johnny', 'JK']]]);
  });
});
