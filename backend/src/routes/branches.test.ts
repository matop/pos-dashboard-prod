import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../index';
import { pool } from '../db';

const API_KEY = process.env.API_SECRET_KEY!;
const BASE_URL = '/api/branches';

function mockQuerySuccess(rows: object[] = []) {
  (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows });
}

function mockQueryError(message: string) {
  (pool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error(message));
}

describe('GET /api/branches', () => {
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

  it('400 con empkey negativo', async () => {
    const res = await request(app)
      .get(`${BASE_URL}?empkey=-1`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(400);
  });

  // ─── RESPONSE FORMAT ──────────────────────────────────────────────────────
  it('200 — retorna branches array', async () => {
    mockQuerySuccess([
      { ubicod: 'SUC1', nombre: 'Sucursal Central' },
      { ubicod: 'SUC2', nombre: 'Sucursal Norte' },
    ]);
    const res = await request(app)
      .get(`${BASE_URL}?empkey=1136`)
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('branches');
    expect(Array.isArray(res.body.branches)).toBe(true);
    expect(res.body.branches).toHaveLength(2);
    expect(res.body.branches[0]).toHaveProperty('ubicod', 'SUC1');
    expect(res.body.branches[0]).toHaveProperty('nombre', 'Sucursal Central');
  });

  it('200 — array vacío cuando no hay sucursales', async () => {
    mockQuerySuccess([]);
    const res = await request(app)
      .get(`${BASE_URL}?empkey=9999`)
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.branches).toHaveLength(0);
  });

  // ─── ERROR HANDLING ───────────────────────────────────────────────────────
  it('500 cuando pool.query falla', async () => {
    mockQueryError('connection refused');
    const res = await request(app)
      .get(`${BASE_URL}?empkey=1136`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Error interno del servidor');
  });
});
