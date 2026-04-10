import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../index';
import { pool } from '../db';

const API_KEY = process.env.API_SECRET_KEY!;
const BASE_URL = '/api/products';

function mockQuerySuccess(rows: object[] = []) {
  (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows });
}

function mockQueryError(message: string) {
  (pool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error(message));
}

describe('GET /api/products', () => {
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

  it('400 con empkey inválido (texto)', async () => {
    const res = await request(app)
      .get(`${BASE_URL}?empkey=abc`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(400);
  });

  // ─── RESPONSE FORMAT ──────────────────────────────────────────────────────
  it('200 — retorna products array', async () => {
    mockQuerySuccess([
      { productokey: 1, descripcion: 'Coca Cola 500ml' },
      { productokey: 2, descripcion: 'Pepsi 500ml' },
    ]);
    const res = await request(app)
      .get(`${BASE_URL}?empkey=1136`)
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('products');
    expect(Array.isArray(res.body.products)).toBe(true);
    expect(res.body.products).toHaveLength(2);
    expect(res.body.products[0]).toHaveProperty('productokey', 1);
    expect(res.body.products[0]).toHaveProperty('descripcion', 'Coca Cola 500ml');
  });

  it('200 — array vacío cuando no hay productos', async () => {
    mockQuerySuccess([]);
    const res = await request(app)
      .get(`${BASE_URL}?empkey=9999`)
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(0);
  });

  // ─── ERROR HANDLING ───────────────────────────────────────────────────────
  it('500 cuando pool.query falla', async () => {
    mockQueryError('timeout');
    const res = await request(app)
      .get(`${BASE_URL}?empkey=1136`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Error interno del servidor');
  });
});
