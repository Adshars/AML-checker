import { jest } from '@jest/globals';
import crypto from 'crypto';
import { Op } from 'sequelize';

export type Row = Record<string, unknown>;
type Where = Record<string | symbol, unknown>;

// structuredClone returns Dates from another realm than the Jest VM — no instanceof checks
const isDate = (value: unknown): value is Date => Object.prototype.toString.call(value) === '[object Date]';
const comparable = (value: unknown): unknown => (isDate(value) ? value.getTime() : value);

const likeToRegExp = (pattern: string): RegExp => {
  const escaped = pattern.replace(/\\([\\%_])|([.*+?^${}()|[\]\\])|(%)|(_)/g, (_m, literal, special, percent, underscore) => {
    if (literal) return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (special) return `\\${special}`;
    if (percent) return '.*';
    if (underscore) return '.';
    return '';
  });
  return new RegExp(`^${escaped}$`, 'i');
};

const matchOperators = (cell: unknown, ops: Where): boolean =>
  Reflect.ownKeys(ops).every((op) => {
    const expected = comparable(ops[op]);
    const actual = comparable(cell);
    switch (op) {
      case Op.lt: return actual !== null && actual !== undefined && (actual as number) < (expected as number);
      case Op.lte: return actual !== null && actual !== undefined && (actual as number) <= (expected as number);
      case Op.gt: return actual !== null && actual !== undefined && (actual as number) > (expected as number);
      case Op.gte: return actual !== null && actual !== undefined && (actual as number) >= (expected as number);
      case Op.iLike: return typeof cell === 'string' && likeToRegExp(String(expected)).test(cell);
      default: throw new Error(`Operator not supported in tests: ${String(op)}`);
    }
  });

/**
 * Subset of Sequelize where semantics used by SequelizeVerificationRepository
 */
export const matches = (row: Row, where: Where = {}): boolean =>
  Reflect.ownKeys(where).every((key) => {
    const expected = where[key];
    if (key === Op.or) return (expected as Where[]).some((sub) => matches(row, sub));
    const cell = row[key as string];
    if (expected === null) return cell === null || cell === undefined;
    if (isDate(expected)) return isDate(cell) && cell.getTime() === expected.getTime();
    if (typeof expected === 'object' && !Array.isArray(expected)) return matchOperators(cell, expected as Where);
    return cell === expected;
  });

const wrap = (row: Row) => ({ get: () => structuredClone(row) });

/**
 * In-memory stand-in for the Verification Sequelize model
 */
export const createInMemoryModel = () => {
  const rows: Row[] = [];

  const sorted = (list: Row[], order?: [string, string][]) => {
    if (!order?.length) return list;
    const [field, direction] = order[0];
    return [...list].sort((a, b) => {
      const diff = (comparable(a[field]) as number) - (comparable(b[field]) as number);
      return direction === 'DESC' ? -diff : diff;
    });
  };

  const model = {
    create: jest.fn(async (data: Row) => {
      const now = new Date();
      const row = { ...structuredClone(data), id: crypto.randomUUID(), createdAt: now, updatedAt: now };
      rows.push(row);
      return wrap(row);
    }),
    findOne: jest.fn(async ({ where }: { where: Where }) => {
      const row = rows.find((r) => matches(r, where));
      return row ? wrap(row) : null;
    }),
    findAll: jest.fn(async ({ where, order, limit }: { where: Where; order?: [string, string][]; limit?: number }) =>
      sorted(rows.filter((r) => matches(r, where)), order).slice(0, limit ?? rows.length).map(wrap)),
    findAndCountAll: jest.fn(async ({ where, order, limit, offset }: { where: Where; order?: [string, string][]; limit: number; offset: number }) => {
      const matching = sorted(rows.filter((r) => matches(r, where)), order);
      return { rows: matching.slice(offset, offset + limit).map(wrap), count: matching.length };
    }),
    update: jest.fn(async (patch: Row, { where }: { where: Where }) => {
      const matching = rows.filter((r) => matches(r, where));
      matching.forEach((r) => Object.assign(r, structuredClone(patch), { updatedAt: new Date() }));
      return [matching.length];
    })
  };

  return { rows, model };
};
