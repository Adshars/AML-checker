import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getReferenceNumber,
  getResultVariant,
  getExportFilename,
  buildDocumentDefinition,
  generateConfirmationPdf,
} from '../utils/pdfConfirmation';

const baseLog = (overrides = {}) => ({
  id: 'abcdef12-3456-7890-abcd-ef1234567890',
  organizationId: 'org-1',
  userId: 'user-1',
  userEmail: 'jan@test.pl',
  userName: 'Jan Kowalski',
  searchQuery: 'Jan Nowak',
  hasHit: false,
  hitsCount: 0,
  entityName: null,
  entityScore: null,
  entityCountries: null,
  entityDatasets: null,
  entityDescription: null,
  hitDetails: null,
  isSanctioned: false,
  isPep: false,
  createdAt: '2026-07-31T14:32:00.000Z',
  ...overrides,
});

describe('getReferenceNumber', () => {
  it('derives AML-<year>-<first 7 id chars uppercased> from the log', () => {
    const log = baseLog({ id: 'abcdef12-3456', createdAt: '2026-07-31T14:32:00.000Z' });
    expect(getReferenceNumber(log)).toBe('AML-2026-ABCDEF1');
  });
});

describe('getExportFilename', () => {
  it('builds aml-confirmation-<reference>-<date>.pdf', () => {
    const log = baseLog({ id: 'abcdef12-3456', createdAt: '2026-07-31T14:32:00.000Z' });
    expect(getExportFilename(log)).toBe('aml-confirmation-AML-2026-ABCDEF1-2026-07-31.pdf');
  });
});

describe('getResultVariant', () => {
  it('returns the sanctioned variant when isSanctioned is true', () => {
    const variant = getResultVariant(baseLog({ hasHit: true, isSanctioned: true }));
    expect(variant.key).toBe('sanctioned');
    expect(variant.iconShape).toBe('triangle');
  });

  it('returns the pep variant when isPep is true and not sanctioned', () => {
    const variant = getResultVariant(baseLog({ hasHit: true, isPep: true }));
    expect(variant.key).toBe('pep');
    expect(variant.iconShape).toBe('triangle');
  });

  it('returns the generic hit variant when hasHit is true but neither sanctioned nor pep', () => {
    const variant = getResultVariant(baseLog({ hasHit: true }));
    expect(variant.key).toBe('hit');
    expect(variant.iconShape).toBe('triangle');
    // Same visual style as "sanctioned" (per Adam's decision), but a different title.
    expect(variant.badgeTitle).not.toContain('sankcyjna');
  });

  it('returns the clean variant when there is no hit', () => {
    const variant = getResultVariant(baseLog());
    expect(variant.key).toBe('clean');
    expect(variant.iconShape).toBe('check');
  });
});

describe('buildDocumentDefinition', () => {
  it('includes the reference number, date, organization, performer and query in the meta section', () => {
    const log = baseLog();
    const docDef = buildDocumentDefinition({ log, organizationName: 'PrzykładowaFirma Sp. z o.o.' });
    const json = JSON.stringify(docDef);

    expect(json).toContain(getReferenceNumber(log));
    expect(json).toContain('PrzykładowaFirma Sp. z o.o.');
    expect(json).toContain('Jan Kowalski');
    expect(json).toContain('Jan Nowak');
  });

  it('falls back to an em dash when organizationName is not provided', () => {
    const docDef = buildDocumentDefinition({ log: baseLog() });
    expect(JSON.stringify(docDef)).toContain('—');
  });

  it('shows "API Key" as the performer for API-authenticated logs', () => {
    const docDef = buildDocumentDefinition({ log: baseLog({ userId: 'API', userName: null, userEmail: 'api@system' }) });
    expect(JSON.stringify(docDef)).toContain('API Key');
  });

  it('repeats the document header on every page via a header callback, appending "ciąg dalszy" from page 2 onward', () => {
    const docDef = buildDocumentDefinition({ log: baseLog() });
    expect(typeof docDef.header).toBe('function');

    const page1 = JSON.stringify(docDef.header(1, 3));
    const page2 = JSON.stringify(docDef.header(2, 3));
    expect(page1).not.toContain('ciąg dalszy');
    expect(page2).toContain('ciąg dalszy');
  });

  it('renders a footer with the reference number and "Strona X / N"', () => {
    const log = baseLog();
    const docDef = buildDocumentDefinition({ log });
    expect(typeof docDef.footer).toBe('function');

    const footer = JSON.stringify(docDef.footer(2, 3));
    expect(footer).toContain(getReferenceNumber(log));
    expect(footer).toContain('2 / 3');
  });

  it('omits the entity data and extended details tables when there is no hit', () => {
    const docDef = buildDocumentDefinition({ log: baseLog() });
    const tables = docDef.content.filter((node) => node?.table?.widths?.[0] === '35%');
    expect(tables).toHaveLength(0);
  });

  it('includes the entity data table with match score when there is a hit', () => {
    const log = baseLog({
      hasHit: true,
      isSanctioned: true,
      hitsCount: 1,
      entityName: 'Viktor Petrov',
      entityScore: 0.94,
      entityDescription: 'Former deputy minister',
      entityCountries: 'Russia, Belarus',
      entityDatasets: ['OFAC SDN List', 'EU Consolidated List'],
    });
    const docDef = buildDocumentDefinition({ log });
    const json = JSON.stringify(docDef);

    expect(json).toContain('Viktor Petrov');
    expect(json).toContain('94%');
    expect(json).toContain('Former deputy minister');
    expect(json).toContain('Russia, Belarus');
    expect(json).toContain('OFAC SDN List, EU Consolidated List');
  });

  it('omits the match-score row when entityScore is null', () => {
    const log = baseLog({ hasHit: true, isSanctioned: true, entityName: 'Viktor Petrov', entityScore: null });
    const docDef = buildDocumentDefinition({ log });
    const entityTable = docDef.content.find((node) => node?.table?.widths?.[0] === '35%')?.table;
    const rowLabels = entityTable.body.map((row) => JSON.stringify(row[0]));
    expect(rowLabels.some((label) => label.includes('Dopasowanie'))).toBe(false);
  });

  it('builds one details-table row per extended-details entry, in the same order as ExtendedDetails.jsx', () => {
    const log = baseLog({
      hasHit: true,
      isSanctioned: true,
      hitDetails: { nationality: 'RU', name: ['Viktor Petrov'], schema: 'Person' },
    });
    const docDef = buildDocumentDefinition({ log });
    const detailsTable = docDef.content.filter((node) => node?.table).pop().table;

    // 'schema' is filtered out (IGNORED_KEYS); 'name' outranks 'nationality' (PRIORITY_KEYS).
    expect(detailsTable.body).toHaveLength(2);
    expect(JSON.stringify(detailsTable.body[0])).toContain('Name');
    expect(JSON.stringify(detailsTable.body[1])).toContain('Nationality');
  });

  it('handles a large hitDetails object destined to span multiple pages', () => {
    const manyFields = Object.fromEntries(
      Array.from({ length: 60 }, (_, i) => [`customField${i}`, `value ${i}`])
    );
    const log = baseLog({ hasHit: true, isSanctioned: true, hitDetails: manyFields });
    const docDef = buildDocumentDefinition({ log });
    const detailsTable = docDef.content.filter((node) => node?.table).pop().table;

    expect(detailsTable.body).toHaveLength(60);
  });

  it('includes a closing note mentioning the total hit count', () => {
    const log = baseLog({ hasHit: true, isSanctioned: true, hitsCount: 3 });
    const docDef = buildDocumentDefinition({ log });
    expect(JSON.stringify(docDef)).toContain('3');
  });
});

vi.mock('pdfmake/build/pdfmake', () => ({
  default: { vfs: {}, createPdf: vi.fn(() => ({ download: vi.fn() })) },
}));
vi.mock('pdfmake/build/vfs_fonts', () => ({ default: {} }));

describe('generateConfirmationPdf', () => {
  beforeEach(async () => {
    const pdfMake = (await import('pdfmake/build/pdfmake')).default;
    pdfMake.createPdf.mockClear();
  });

  it('builds a document definition and triggers a download with the expected filename', async () => {
    const pdfMake = (await import('pdfmake/build/pdfmake')).default;
    const downloadMock = vi.fn();
    pdfMake.createPdf.mockReturnValue({ download: downloadMock });

    const log = baseLog();
    generateConfirmationPdf(log, 'PrzykładowaFirma Sp. z o.o.');

    expect(pdfMake.createPdf).toHaveBeenCalledTimes(1);
    expect(downloadMock).toHaveBeenCalledWith(getExportFilename(log));
  });
});
