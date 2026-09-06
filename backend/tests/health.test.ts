import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import type { Server } from 'node:http';

vi.mock('pino-http', () => ({
  pinoHttp: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../src/db.js', () => ({
  pool: {
    query: vi.fn(),
  },
}));

process.env.DATABASE_URL = 'postgres://test';
process.env.JWT_SECRET = '1234567890123456';

const { app } = await import('../src/app.js');
const { pool } = await import('../src/db.js');

let server: Server;
let base: string;

beforeAll(async () => {
  server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });

  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Missing server address');
  }

  base = `http://127.0.0.1:${address.port}`;
});

afterAll(
  () =>
    new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    }),
);

beforeEach(() => {
  vi.mocked(pool.query).mockReset();
});

describe('health endpoint', () => {
  it('reports that the application and database are healthy', async () => {
    vi.mocked(pool.query).mockResolvedValue({
      rows: [{ one: 1 }],
      rowCount: 1,
    } as never);

    const response = await fetch(`${base}/health`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: 'ok',
      database: 'ok',
    });
    expect(body.timestamp).toEqual(expect.any(String));
    expect(pool.query).toHaveBeenCalledWith('SELECT 1');
  });

  it('returns 503 when the database is unavailable', async () => {
    vi.mocked(pool.query).mockRejectedValue(new Error('Database unavailable'));

    const response = await fetch(`${base}/health`);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: 'degraded',
      database: 'unavailable',
    });
    expect(pool.query).toHaveBeenCalledWith('SELECT 1');
  });
});
