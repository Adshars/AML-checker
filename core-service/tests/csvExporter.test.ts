import { buildHistoryCsv } from '../src/application/services/HistoryCsvExporter.js';
import { AuditLog } from '../src/domain/entities/AuditLog.js';

const baseLog = (overrides: Partial<ConstructorParameters<typeof AuditLog>[0]> = {}): AuditLog =>
  new AuditLog({
    organizationId: 'org-1',
    searchQuery: 'John Doe',
    createdAt: new Date('2026-07-15T10:30:00.000Z'),
    ...overrides
  });

describe('buildHistoryCsv', () => {
  it('starts with a UTF-8 BOM', () => {
    const csv = buildHistoryCsv([]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('writes a semicolon-separated header row with the expected columns', () => {
    const csv = buildHistoryCsv([]);
    const headerLine = csv.slice(1).split('\r\n')[0];
    expect(headerLine).toBe('Date;User;Search Query;Result;Entity Name;Countries;Datasets');
  });

  it('writes one data row per audit log, semicolon-separated', () => {
    const log = baseLog({
      userName: 'Alice',
      entityName: 'Vladimir Putin',
      entityCountries: 'RU',
      entityDatasets: 'us_ofac_sdn'
    });

    const csv = buildHistoryCsv([log]);
    const lines = csv.slice(1).split('\r\n');

    expect(lines[1]).toBe(
      `${log.createdAt.toLocaleString('pl-PL')};Alice;John Doe;CLEAN;Vladimir Putin;RU;us_ofac_sdn`
    );
  });

  it('labels the result as HIT SANCTION when isSanctioned is true', () => {
    const log = baseLog({ hasHit: true, isSanctioned: true });
    const csv = buildHistoryCsv([log]);
    expect(csv).toContain(';HIT SANCTION;');
  });

  it('labels the result as HIT PEP when isPep is true and not sanctioned', () => {
    const log = baseLog({ hasHit: true, isPep: true });
    const csv = buildHistoryCsv([log]);
    expect(csv).toContain(';HIT PEP;');
  });

  it('labels the result as HIT when hasHit is true but neither sanctioned nor PEP', () => {
    const log = baseLog({ hasHit: true });
    const csv = buildHistoryCsv([log]);
    expect(csv).toContain(';HIT;');
  });

  it('labels the result as CLEAN when there is no hit', () => {
    const log = baseLog();
    const csv = buildHistoryCsv([log]);
    expect(csv).toContain(';CLEAN;');
  });

  it('renders "API Key" for the user column when userId is API', () => {
    const log = baseLog({ userId: 'API', userName: null, userEmail: null });
    const csv = buildHistoryCsv([log]);
    const dataLine = csv.slice(1).split('\r\n')[1];
    expect(dataLine.split(';')[1]).toBe('API Key');
  });

  it('falls back through userName, userEmail, userId, then em dash for the user column', () => {
    const noUser = baseLog({ userId: null, userName: null, userEmail: null });
    const csv = buildHistoryCsv([noUser]);
    const dataLine = csv.slice(1).split('\r\n')[1];
    expect(dataLine.split(';')[1]).toBe('—');
  });

  it('quotes and escapes values containing the separator, quotes, or newlines', () => {
    const log = baseLog({ searchQuery: 'Smith; "The Boss"\nJr.' });
    const csv = buildHistoryCsv([log]);
    const dataLine = csv.slice(1).split('\r\n')[1];
    expect(dataLine).toContain('"Smith; ""The Boss""\nJr."');
  });

  it('renders an em dash for missing optional fields', () => {
    const log = baseLog({ entityName: null, entityCountries: null, entityDatasets: null });
    const csv = buildHistoryCsv([log]);
    const dataLine = csv.slice(1).split('\r\n')[1];
    const cells = dataLine.split(';');
    expect(cells.slice(4)).toEqual(['—', '—', '—']);
  });
});
