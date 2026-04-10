import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../index';
import { pool } from '../db';

const API_KEY = process.env.API_SECRET_KEY!;
const BASE_URL = '/api/charts/sales-history';

function mockQuerySuccess(rows: object[] = []) {
  (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows });
}

function mockQueryError(message: string) {
  (pool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error(message));
}

const DEFAULT_ROWS = [
  { day: '20260401', total: '150000' },
  { day: '20260402', total: '200000' },
];

describe('GET /api/charts/sales-history', () => {
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
      .get(`${BASE_URL}?empkey=1136&from=baddate`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(400);
  });

  it('400 con to inválido', async () => {
    const res = await request(app)
      .get(`${BASE_URL}?empkey=1136&to=19991231`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(400);
  });

  it('400 cuando from > to', async () => {
    const res = await request(app)
      .get(`${BASE_URL}?empkey=1136&from=20260501&to=20260401`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/from/i);
  });

  it('400 con refDate inválido', async () => {
    const res = await request(app)
      .get(`${BASE_URL}?empkey=1136&refDate=notadate`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(400);
  });

  it('400 con ubicod demasiado largo', async () => {
    const longUbicod = 'X'.repeat(51);
    const res = await request(app)
      .get(`${BASE_URL}?empkey=1136&ubicod=${longUbicod}`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(400);
  });

  // ─── RESPONSE FORMAT ──────────────────────────────────────────────────────
  it('200 — retorna data array con day y total numéricos', async () => {
    mockQuerySuccess(DEFAULT_ROWS);
    const res = await request(app)
      .get(`${BASE_URL}?empkey=1136`)
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);

    const item = res.body.data[0];
    expect(item).toHaveProperty('day');
    expect(item).toHaveProperty('total');
    expect(typeof item.day).toBe('number');
    expect(typeof item.total).toBe('number');
    expect(item.day).toBe(20260401);
    expect(item.total).toBe(150000);
  });

  it('200 con from + to válidos', async () => {
    mockQuerySuccess(DEFAULT_ROWS);
    const res = await request(app)
      .get(`${BASE_URL}?empkey=1136&from=20260301&to=20260401`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
  });

  // ─── refDate: effectiveTo ─────────────────────────────────────────────────
  it('200 con refDate — aplica effectiveTo sin fallar', async () => {
    mockQuerySuccess(DEFAULT_ROWS);
    const res = await request(app)
      .get(`${BASE_URL}?empkey=1136&refDate=20260301`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('200 con from + refDate como effectiveTo cuando no hay to explícito', async () => {
    mockQuerySuccess(DEFAULT_ROWS);
    const res = await request(app)
      .get(`${BASE_URL}?empkey=1136&from=20260201&refDate=20260301`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(200);

    // pool.query debe haberse llamado con params que incluyen 20260201 y 20260301
    const [, params] = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(params).toContain(20260201);
    expect(params).toContain(20260301);
  });

  // ─── SQL PARAMETERIZATION ─────────────────────────────────────────────────
  it('pool.query — sin params huérfanos (sin filtros opcionales)', async () => {
    mockQuerySuccess(DEFAULT_ROWS);
    await request(app)
      .get(`${BASE_URL}?empkey=1136`)
      .set('x-api-key', API_KEY);

    const [sql, params] = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0];
    const placeholders = sql.match(/\$(\d+)/g) || [];
    const usedIndices = new Set(placeholders.map((p: string) => parseInt(p.slice(1))));
    for (let i = 1; i <= params.length; i++) {
      expect(usedIndices.has(i)).toBe(true);
    }
  });

  it('pool.query — sin params huérfanos (con todos los filtros)', async () => {
    mockQuerySuccess(DEFAULT_ROWS);
    await request(app)
      .get(`${BASE_URL}?empkey=1136&from=20260301&refDate=20260401&ubicod=SUC1&products=1,2`)
      .set('x-api-key', API_KEY);

    const [sql, params] = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0];
    const placeholders = sql.match(/\$(\d+)/g) || [];
    const usedIndices = new Set(placeholders.map((p: string) => parseInt(p.slice(1))));
    for (let i = 1; i <= params.length; i++) {
      expect(usedIndices.has(i)).toBe(true);
    }
  });

  // ─── ERROR HANDLING ───────────────────────────────────────────────────────
  it('500 cuando pool.query falla', async () => {
    mockQueryError('DB error');
    const res = await request(app)
      .get(`${BASE_URL}?empkey=1136`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Error interno del servidor');
  });
});
