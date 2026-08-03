import type { AuditLog } from '../../domain/entities/AuditLog.js';

const CSV_BOM = '﻿';
const SEPARATOR = ';';
const NEWLINE = '\r\n';
const EMPTY_VALUE = '—';

const HEADERS = ['Date', 'User', 'Search Query', 'Result', 'Entity Name', 'Countries', 'Datasets'];

const escapeCsvValue = (value: string): string => {
  if (/[";\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

const resultLabel = (log: AuditLog): string => {
  if (log.isSanctioned) return 'HIT SANCTION';
  if (log.isPep) return 'HIT PEP';
  if (log.hasHit) return 'HIT';
  return 'CLEAN';
};

const userLabel = (log: AuditLog): string => {
  if (log.userId === 'API') return 'API Key';
  return log.userName || log.userEmail || log.userId || EMPTY_VALUE;
};

const toRow = (log: AuditLog): string => {
  const cells = [
    log.createdAt.toLocaleString('pl-PL'),
    userLabel(log),
    log.searchQuery,
    resultLabel(log),
    log.entityName || EMPTY_VALUE,
    log.entityCountries || EMPTY_VALUE,
    log.entityDatasets || EMPTY_VALUE
  ];

  return cells.map((cell) => escapeCsvValue(String(cell))).join(SEPARATOR);
};

/**
 * Builds a semicolon-separated, UTF-8 BOM-prefixed CSV matching the
 * columns of the History table, for Polish-locale Excel compatibility.
 */
export const buildHistoryCsv = (logs: AuditLog[]): string => {
  const lines = [HEADERS.join(SEPARATOR), ...logs.map(toRow)];
  return CSV_BOM + lines.join(NEWLINE);
};

export default buildHistoryCsv;
