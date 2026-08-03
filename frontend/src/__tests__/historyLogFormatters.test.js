import { describe, it, expect } from 'vitest';
import { getLatinName, formatDatasets, getUserLabel } from '../utils/historyLogFormatters';

describe('getLatinName', () => {
  it('finds a Latin-script name in hitDetails.name array', () => {
    expect(getLatinName('Владимир Путин', { name: ['Владимир Путин', 'Vladimir Putin'] })).toBe('Vladimir Putin');
  });

  it('falls back to the first hitDetails.name entry when none are Latin-script', () => {
    expect(getLatinName(null, { name: ['Владимир Путин'] })).toBe('Владимир Путин');
  });

  it('falls back to entityName when hitDetails has no name array', () => {
    expect(getLatinName('Jan Kowalski', {})).toBe('Jan Kowalski');
  });

  it('returns the first element when entityName is an array', () => {
    expect(getLatinName(['Jan Kowalski', 'J. Kowalski'], null)).toBe('Jan Kowalski');
  });

  it('returns "Unknown Entity" when nothing is available', () => {
    expect(getLatinName(null, null)).toBe('Unknown Entity');
  });
});

describe('formatDatasets', () => {
  it('joins array datasets with a comma', () => {
    expect(formatDatasets(['us_ofac_sdn', 'eu_sanctions'])).toBe('us_ofac_sdn, eu_sanctions');
  });

  it('returns a string dataset as-is', () => {
    expect(formatDatasets('us_ofac_sdn')).toBe('us_ofac_sdn');
  });

  it('returns an em dash for missing datasets', () => {
    expect(formatDatasets(null)).toBe('—');
    expect(formatDatasets(undefined)).toBe('—');
  });
});

describe('getUserLabel', () => {
  it('returns "API Key" for API-authenticated logs', () => {
    expect(getUserLabel('API', 'api@system', null)).toBe('API Key');
  });

  it('prefers userName, then userEmail, then userId, then em dash', () => {
    expect(getUserLabel('u1', 'user@test.com', 'Alice')).toBe('Alice');
    expect(getUserLabel('u1', 'user@test.com', null)).toBe('user@test.com');
    expect(getUserLabel('u1', null, null)).toBe('u1');
    expect(getUserLabel(null, null, null)).toBe('—');
  });
});
