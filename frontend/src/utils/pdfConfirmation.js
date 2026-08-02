import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { getExtendedDetailsEntries, formatKey } from './extendedDetailsMapper';
import { getLatinName, formatDatasets, getUserLabel } from './historyLogFormatters';

pdfMake.vfs = pdfFonts;

// Design tokens from the Phase 2 theme, plus the PDF-only tints/text colors
// from PLAN_FAZA3_4.md (kept local here rather than in the SCSS theme, since
// nothing outside this module uses them).
const COLORS = {
  primary: '#1B2A4A',
  accent: '#0F9D82',
  danger: '#B23B2E',
  border: '#E1E4E9',
  textSecondary: '#5B6472',
  textMuted: '#9CA0AC',
  bgAccentTint: '#DFF3EE',
  bgDangerTint: '#FBEAE7',
  bgWarningTint: '#F5ECE0',
  tealText: '#0A6E5A',
  warningText: '#8C6023',
  white: '#FFFFFF',
};

const PAGE_MARGIN_X = 68;
const CONTENT_WIDTH = 595.28 - PAGE_MARGIN_X * 2;
const EMPTY_VALUE = '—';

export const getReferenceNumber = (log) => {
  const year = new Date(log.createdAt).getFullYear();
  const idFragment = (log.id || '').slice(0, 7).toUpperCase();
  return `AML-${year}-${idFragment}`;
};

export const getExportFilename = (log) => {
  const reference = getReferenceNumber(log);
  const date = new Date(log.createdAt).toISOString().slice(0, 10);
  return `aml-confirmation-${reference}-${date}.pdf`;
};

/**
 * Reuses the exact renderResultBadge() decision logic from HistoryPage.jsx.
 * The "hit" variant (hasHit but neither sanctioned nor PEP) is an edge case
 * absent from the mockups — by Adam's decision it shares the sanctioned
 * variant's visual style, only the title differs.
 */
export const getResultVariant = (log) => {
  if (log.isSanctioned) {
    return {
      key: 'sanctioned',
      badgeTitle: 'Trafienie — lista sankcyjna',
      badgeDescription: 'Zidentyfikowano podmiot znajdujący się na liście sankcyjnej. Wymagana weryfikacja manualna.',
      bg: COLORS.bgDangerTint,
      iconColor: COLORS.danger,
      textColor: COLORS.danger,
      iconShape: 'triangle',
    };
  }
  if (log.isPep) {
    return {
      key: 'pep',
      badgeTitle: 'Trafienie — osoba eksponowana politycznie (PEP)',
      badgeDescription: 'Zidentyfikowano podmiot jako osobę eksponowaną politycznie. Wymagana wzmożona weryfikacja (EDD).',
      bg: COLORS.bgWarningTint,
      iconColor: COLORS.warningText,
      textColor: COLORS.warningText,
      iconShape: 'triangle',
    };
  }
  if (log.hasHit) {
    return {
      key: 'hit',
      badgeTitle: 'Trafienie',
      badgeDescription: 'Zidentyfikowano potencjalne dopasowanie. Wymagana weryfikacja manualna.',
      bg: COLORS.bgDangerTint,
      iconColor: COLORS.danger,
      textColor: COLORS.danger,
      iconShape: 'triangle',
    };
  }
  return {
    key: 'clean',
    badgeTitle: 'Brak trafień',
    badgeDescription: 'Sprawdzenie nie wykazało dopasowań na listach sankcyjnych ani PEP.',
    bg: COLORS.bgAccentTint,
    iconColor: COLORS.tealText,
    textColor: COLORS.tealText,
    iconShape: 'check',
  };
};

const noBorderLayout = {
  hLineWidth: () => 0,
  vLineWidth: () => 0,
  paddingLeft: () => 0,
  paddingRight: () => 0,
  paddingTop: () => 0,
  paddingBottom: () => 0,
};

const buildHeader = (currentPage) => ({
  table: {
    widths: ['*'],
    body: [[
      {
        fillColor: COLORS.primary,
        margin: [PAGE_MARGIN_X, 18, PAGE_MARGIN_X, 18],
        columns: [
          {
            width: 44,
            stack: [
              { canvas: [{ type: 'rect', x: 0, y: 0, w: 44, h: 44, r: 8, color: COLORS.accent }] },
              { text: 'AML', color: COLORS.white, bold: true, fontSize: 12, alignment: 'center', relativePosition: { x: 0, y: -30 } },
            ],
          },
          {
            width: '*',
            margin: [12, 2, 0, 0],
            stack: [
              { text: 'AML-Checker', color: COLORS.white, bold: true, fontSize: 20 },
              {
                text: `Potwierdzenie sprawdzenia sankcyjnego${currentPage > 1 ? ' · ciąg dalszy' : ''}`,
                color: '#C7D0DE',
                fontSize: 10,
                margin: [0, 3, 0, 0],
              },
            ],
          },
        ],
      },
    ]],
  },
  layout: noBorderLayout,
});

const buildFooter = (currentPage, pageCount, referenceNumber) => ({
  margin: [PAGE_MARGIN_X, 8, PAGE_MARGIN_X, 0],
  stack: [
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: CONTENT_WIDTH, y2: 0, lineColor: COLORS.border }] },
    {
      columns: [
        {
          width: '*',
          stack: [
            { text: 'Dokument wygenerowany automatycznie przez AML-Checker. Nie stanowi porady prawnej.', fontSize: 8, color: COLORS.textMuted, margin: [0, 6, 0, 0] },
            { text: `Identyfikator dokumentu: ${referenceNumber}`, fontSize: 8, color: COLORS.textMuted },
          ],
        },
        { width: 'auto', text: `Strona ${currentPage} / ${pageCount}`, fontSize: 9, color: COLORS.textMuted, margin: [0, 6, 0, 0] },
      ],
    },
  ],
});

const metaField = (label, value) => ({
  stack: [
    { text: label.toUpperCase(), fontSize: 8, bold: true, color: COLORS.textSecondary, margin: [0, 0, 0, 3] },
    { text: value || EMPTY_VALUE, fontSize: 12, color: COLORS.primary, margin: [0, 0, 0, 10] },
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: CONTENT_WIDTH / 2 - 12, y2: 0, lineColor: COLORS.border }] },
  ],
});

const buildMetaSection = ({ referenceNumber, log, organizationName }) => ({
  margin: [0, 24, 0, 16],
  stack: [
    {
      columns: [
        metaField('Numer referencyjny', referenceNumber),
        metaField('Data i godzina sprawdzenia', new Date(log.createdAt).toLocaleString()),
      ],
      columnGap: 24,
    },
    {
      columns: [
        metaField('Organizacja', organizationName || EMPTY_VALUE),
        metaField('Wykonał', getUserLabel(log.userId, log.userEmail, log.userName)),
      ],
      columnGap: 24,
    },
    { text: 'SPRAWDZANE ZAPYTANIE', fontSize: 8, bold: true, color: COLORS.textSecondary, margin: [0, 0, 0, 3] },
    { text: `"${log.searchQuery}"`, fontSize: 14, bold: true, color: COLORS.primary, margin: [0, 0, 0, 10] },
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: CONTENT_WIDTH, y2: 0, lineColor: COLORS.border }] },
  ],
});

const buildBadgeIcon = (variant) => {
  if (variant.iconShape === 'check') {
    return {
      canvas: [
        { type: 'ellipse', x: 16, y: 16, r1: 15, r2: 15, lineColor: variant.iconColor, lineWidth: 2 },
        { type: 'polyline', lineColor: variant.iconColor, lineWidth: 2, points: [{ x: 9, y: 16 }, { x: 14, y: 21 }, { x: 23, y: 10 }] },
      ],
    };
  }
  return {
    canvas: [
      { type: 'polyline', closePath: true, lineColor: variant.iconColor, lineWidth: 2, points: [{ x: 16, y: 3 }, { x: 30, y: 28 }, { x: 2, y: 28 }] },
      { type: 'line', x1: 16, y1: 12, x2: 16, y2: 20, lineColor: variant.iconColor, lineWidth: 2 },
      { type: 'ellipse', x: 16, y: 24, r1: 1.4, r2: 1.4, color: variant.iconColor },
    ],
  };
};

const buildBadgeSection = (variant) => ({
  table: {
    widths: [40, '*'],
    body: [[
      { ...buildBadgeIcon(variant), margin: [8, 8, 0, 8] },
      {
        margin: [8, 10, 12, 10],
        stack: [
          { text: variant.badgeTitle, bold: true, fontSize: 15, color: variant.textColor },
          { text: variant.badgeDescription, fontSize: 10, color: variant.textColor, margin: [0, 2, 0, 0] },
        ],
      },
    ]],
  },
  layout: { ...noBorderLayout, fillColor: () => variant.bg },
  margin: [0, 0, 0, 16],
});

const labelValueTable = (rows) => ({
  table: { widths: ['35%', '*'], body: rows.map(([label, value]) => [
    { text: label, color: COLORS.textSecondary, fontSize: 10, margin: [0, 6, 0, 6] },
    { text: value, color: COLORS.primary, fontSize: 10, margin: [0, 6, 0, 6] },
  ]) },
  layout: {
    hLineWidth: (i) => (i === 0 ? 0 : 1),
    vLineWidth: () => 0,
    hLineColor: () => COLORS.border,
    paddingLeft: () => 0,
    paddingRight: () => 0,
  },
});

const sectionTitle = (text) => ({
  text,
  bold: true,
  fontSize: 12,
  color: COLORS.primary,
  margin: [0, 0, 0, 8],
});

const buildEntityDataSection = (log) => {
  const latinName = getLatinName(log.entityName, log.hitDetails);
  const rows = [
    ['Nazwa podmiotu', latinName],
    ...(log.entityScore != null ? [['Dopasowanie', `${Math.round(log.entityScore * 100)}%`]] : []),
    ['Opis / funkcja', log.entityDescription || log.hitDetails?.position?.[0] || EMPTY_VALUE],
    ['Kraje', log.entityCountries || EMPTY_VALUE],
    ['Zbiór danych', formatDatasets(log.entityDatasets)],
  ];

  return [
    sectionTitle('Dane zidentyfikowanego podmiotu'),
    labelValueTable(rows),
  ];
};

const buildExtendedDetailsSection = (log) => {
  const entries = getExtendedDetailsEntries(log.hitDetails);
  if (entries.length === 0) return [];

  const rows = entries.map(([key, value]) => [formatKey(key), Array.isArray(value) ? value.join(', ') : String(value)]);

  return [
    { ...sectionTitle('Dane szczegółowe'), margin: [0, 16, 0, 8] },
    labelValueTable(rows),
  ];
};

const buildNote = (log) => {
  const text = log.hasHit
    ? `Liczba wszystkich trafień dla tego zapytania: ${log.hitsCount ?? 0}. Prezentowane jest dopasowanie o najwyższym wskaźniku podobieństwa. Sekcja "Dane szczegółowe" zawiera pola dostępne dla danego rekordu — ich zestaw różni się między podmiotami.`
    : 'Zapytanie zostało zweryfikowane w bazie danych OpenSanctions. Nie znaleziono podmiotów spełniających kryteria dopasowania.';

  return { text, fontSize: 8, color: COLORS.textMuted, margin: [0, 16, 0, 0] };
};

export const buildDocumentDefinition = ({ log, organizationName }) => {
  const referenceNumber = getReferenceNumber(log);
  const variant = getResultVariant(log);

  return {
    pageSize: 'A4',
    pageMargins: [PAGE_MARGIN_X, 110, PAGE_MARGIN_X, 60],
    header: (currentPage) => buildHeader(currentPage),
    footer: (currentPage, pageCount) => buildFooter(currentPage, pageCount, referenceNumber),
    content: [
      buildMetaSection({ referenceNumber, log, organizationName }),
      buildBadgeSection(variant),
      ...(log.hasHit ? buildEntityDataSection(log) : []),
      ...(log.hasHit ? buildExtendedDetailsSection(log) : []),
      buildNote(log),
    ],
    defaultStyle: { fontSize: 10 },
  };
};

export const generateConfirmationPdf = (log, organizationName) => {
  const docDefinition = buildDocumentDefinition({ log, organizationName });
  pdfMake.createPdf(docDefinition).download(getExportFilename(log));
};
