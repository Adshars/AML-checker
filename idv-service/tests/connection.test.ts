import { jest } from '@jest/globals';

const queries: { sql: string; params?: unknown[] }[] = [];
let databaseExists = false;
const clientOptions: Record<string, unknown>[] = [];
const end = jest.fn(async () => {});

jest.unstable_mockModule('pg', () => ({
  default: {
    Client: class {
      constructor(options: Record<string, unknown>) {
        clientOptions.push(options);
      }
      async connect() {}
      async query(sql: string, params?: unknown[]) {
        queries.push({ sql, params });
        return { rowCount: sql.startsWith('SELECT') && databaseExists ? 1 : 0 };
      }
      end = end;
    }
  }
}));

jest.unstable_mockModule('../src/shared/logger/index.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

const { ensureDatabaseExists } = await import('../src/infrastructure/database/sequelize/connection.js');

const dbConfig = (name: string) => ({
  host: 'postgres', user: 'admin', password: 'secret', name, dialect: 'postgres' as const, logging: false as const
});

beforeEach(() => {
  queries.length = 0;
  clientOptions.length = 0;
  end.mockClear();
});

describe('ensureDatabaseExists', () => {
  test('creates the database when missing (connecting to the postgres database)', async () => {
    databaseExists = false;

    await expect(ensureDatabaseExists(dbConfig('idv_db'))).resolves.toBe(true);

    expect(clientOptions[0]).toMatchObject({ host: 'postgres', user: 'admin', database: 'postgres' });
    expect(queries[0]).toEqual({ sql: 'SELECT 1 FROM pg_database WHERE datname = $1', params: ['idv_db'] });
    expect(queries[1].sql).toBe('CREATE DATABASE "idv_db"');
    expect(end).toHaveBeenCalled();
  });

  test('does nothing when the database exists', async () => {
    databaseExists = true;

    await expect(ensureDatabaseExists(dbConfig('idv_db'))).resolves.toBe(false);

    expect(queries).toHaveLength(1);
    expect(end).toHaveBeenCalled();
  });

  test.each(['idv-db', 'IDV', 'x"; DROP DATABASE core_db; --', '1db'])('rejects unsafe name %p', async (name) => {
    await expect(ensureDatabaseExists(dbConfig(name))).rejects.toThrow('Invalid database name');
    expect(queries).toHaveLength(0);
  });
});
