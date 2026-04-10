import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../index';
import { pool } from '../db';

const API_KEY = process.env.API_SECRET_KEY!;
const BASE_URL = '/api/charts/top-products';

function mockQuerySuccess(rows: object[] = []) {
  (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows });
}

function mockQueryError(message: string) {
  (pool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error(message));
}

const DEFAULT_ROWS = [
  { productokey: '1', descripcion: 'Producto A', total: '500000' },
  { productokey: '2', descripcion: 'Producto B', total: '300000' },
];

describe('GET /api/charts/top-products', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── AUTH ──────────────────────────────────────────────────────────────────
  it('401 sin x-api-key', async () => {
    const res = await request(app).get(`${BASE_URL}?empkey=1136`);
    expect(res.status).toBe(401);
  });

  it('401 con x-api-key incorrecto', async () => {
    const res = await request(app)
      .get(`${BASE_URL}?empkey=1136`)
      .set('x-api-key', 'wrong-key');
    expect(res.status).toBe(401);
  });

  // ─── VALIDACIÓN ────────────────────────────────────────────────────────────
  it('400 sin empkey', async () => {
    const res = await request(app)
      .get(BASE_URL)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/empkey/i);
  });

  it('400 con from inválido', async () => {
    const res = await request(app)
      .get(`${BASE_URL}?empkey=1136&from=noesunafecha`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(400);
  });

  it('400 con to inválido', async () => {
    const res = await request(app)
      .get(`${BASE_URL}?empkey=1136&to=99999999`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(400);
  });

  it('400 cuando from > to', async () => {
    const res = await request(app)
      .get(`${BASE_URL}?empkey=1136&from=20260401&to=20260301`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/from/i);
  });

  it('400 con ubicod demasiado largo', async () => {
    const longUbicod = 'A'.repeat(51);
    const res = await request(app)
      .get(`${BASE_URL}?empkey=1136&ubicod=${longUbicod}`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(400);
  });

  // ─── RESPONSE FORMAT ──────────────────────────────────────────────────────
  it('200 — retorna data array con productokey, descripcion, total numérico', async () => {
    mockQuerySuccess(DEFAULT_ROWS);
    const res = await request(app)
      .get(`${BASE_URL}?empkey=1136`)
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);

    const item = res.body.data[0];
    expect(item).toHaveProperty('productokey');
    expect(item).toHaveProperty('descripcion');
    expect(item).toHaveProperty('total');
    expect(typeof item.productokey).toBe('number');
    expect(typeof item.total).toBe('number');
  });

  it('200 — descripcion null usa fallback "Producto X"', async () => {
    mockQuerySuccess([{ productokey: '99', descripcion: null, total: '100' }]);
    const res = await request(app)
      .get(`${BASE_URL}?empkey=1136`)
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.data[0].descripcion).toBe('Producto 99');
  });

  it('200 con from + to válidos', async () => {
    mockQuerySuccess(DEFAULT_ROWS);
    const res = await request(app)
      .get(`${BASE_URL}?empkey=1136&from=20260301&to=20260401`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
  });

  it('200 con products filter', async () => {
    mockQuerySuccess(DEFAULT_ROWS);
    const res = await request(app)
      .get(`${BASE_URL}?empkey=1136&products=1,2,3`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
  });

  it('200 array vacío cuando no hay datos', async () => {
    mockQuerySuccess([]);
    const res = await request(app)
      .get(`${BASE_URL}?empkey=1136`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  // ─── ERROR HANDLING ───────────────────────────────────────────────────────
  it('500 cuando pool.query falla', async () => {
    mockQueryError('query timeout');
    const res = await request(app)
      .get(`${BASE_URL}?empkey=1136`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Error interno del servidor');
  });
});
