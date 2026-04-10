import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../index';
import { pool } from '../db';

const API_KEY = process.env.API_SECRET_KEY!;
const BASE_URL = '/api/charts/sales-comparison';

// Helper: mock de pool.query que retorna 1 row con totales
function mockQuerySuccess(totals: Record<string, number> = {}) {
  const row = {
    total_0: totals.total_0 ?? 100000,
    total_1: totals.total_1 ?? 90000,
    total_2: totals.total_2 ?? 80000,
    total_3: totals.total_3 ?? 70000,
    total_4: totals.total_4 ?? 60000,
  };
  (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [row] });
}

function mockQueryError(message: string) {
  (pool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error(message));
}

describe('GET /api/charts/sales-comparison', () => {
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

  it('400 con refDate inválido', async () => {
    const res = await request(app)
      .get(`${BASE_URL}?empkey=1136&refDate=invalid`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(400);
  });

  it('400 con ubicod demasiado largo', async () => {
    const longUbicod = 'A'.repeat(51);
    const res = await request(app)
      .get(`${BASE_URL}?empkey=1136&ubicod=${longUbicod}`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(400);
  });

  // ─── RESPONSE FORMAT ──────────────────────────────────────────────────────
  it('200 con empkey válido — response tiene data y currentHour', async () => {
    mockQuerySuccess();
    const res = await request(app)
      .get(`${BASE_URL}?empkey=1136`)
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('currentHour');
    expect(res.body.data).toHaveLength(5);

    // Cada item tiene label y total
    for (const item of res.body.data) {
      expect(item).toHaveProperty('label');
      expect(item).toHaveProperty('total');
      expect(typeof item.total).toBe('number');
    }
  });

  it('labels son los 5 anchors esperados', async () => {
    mockQuerySuccess();
    const res = await request(app)
      .get(`${BASE_URL}?empkey=1136`)
      .set('x-api-key', API_KEY);

    const labels = res.body.data.map((d: { label: string }) => d.label);
    expect(labels).toEqual([
      'Hoy',
      'Ayer',
      'Hace 1 semana',
      'Hace 1 mes',
      'Hace 1 año',
    ]);
  });

  // ─── CASO CRÍTICO: refDate en el pasado ────────────────────────────────────
  // Este test cubre el bug P20 donde $2 (currentHour) quedaba sin referencia
  it('200 con refDate pasado — NO debe fallar con parámetro huérfano', async () => {
    mockQuerySuccess();
    const res = await request(app)
      .get(`${BASE_URL}?empkey=1136&refDate=20260301`)
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(5);
    expect(res.body.data[0].label).toBe('Hoy');
  });

  it('200 con refDate de hoy — incluye hour filter', async () => {
    // refDate = hoy → el anchor "Hoy" matchea todayDayKey → hour filter activo
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const todayKey = `${y}${m}${d}`;

    mockQuerySuccess();
    const res = await request(app)
      .get(`${BASE_URL}?empkey=1136&refDate=${todayKey}`)
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(5);
  });

  // ─── COMBINACIONES DE FILTROS ─────────────────────────────────────────────
  it('200 con ubicod', async () => {
    mockQuerySuccess();
    const res = await request(app)
      .get(`${BASE_URL}?empkey=1136&ubicod=SUCURSAL1`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(5);
  });

  it('200 con refDate + ubicod', async () => {
    mockQuerySuccess();
    const res = await request(app)
      .get(`${BASE_URL}?empkey=1136&refDate=20260301&ubicod=SUCURSAL1`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(5);
  });

  it('200 con products', async () => {
    mockQuerySuccess();
    const res = await request(app)
      .get(`${BASE_URL}?empkey=1136&products=1,2,3`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
  });

  it('200 con todos los filtros', async () => {
    mockQuerySuccess();
    const res = await request(app)
      .get(`${BASE_URL}?empkey=1136&refDate=20260301&ubicod=SUCURSAL1&products=1,2,3`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(5);
  });

  // ─── SQL PARAMETERIZATION ─────────────────────────────────────────────────
  it('pool.query recibe parámetros sin huecos (sin refDate)', async () => {
    mockQuerySuccess();
    await request(app)
      .get(`${BASE_URL}?empkey=1136`)
      .set('x-api-key', API_KEY);

    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0];

    // Todos los placeholders en el SQL deben tener un param correspondiente
    const placeholders = sql.match(/\$(\d+)/g) || [];
    const maxIdx = Math.max(...placeholders.map((p: string) => parseInt(p.slice(1))));
    expect(params.length).toBeGreaterThanOrEqual(maxIdx);

    // No debe haber params no referenciados
    const usedIndices = new Set(placeholders.map((p: string) => parseInt(p.slice(1))));
    for (let i = 1; i <= params.length; i++) {
      expect(usedIndices.has(i)).toBe(true);
    }
  });

  it('pool.query recibe parámetros sin huecos (con refDate pasado)', async () => {
    mockQuerySuccess();
    await request(app)
      .get(`${BASE_URL}?empkey=1136&refDate=20260301`)
      .set('x-api-key', API_KEY);

    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0];

    const placeholders = sql.match(/\$(\d+)/g) || [];
    const usedIndices = new Set(placeholders.map((p: string) => parseInt(p.slice(1))));

    // Ningún param debe quedar sin referencia en el SQL
    for (let i = 1; i <= params.length; i++) {
      expect(usedIndices.has(i)).toBe(true);
    }
  });

  it('pool.query recibe parámetros sin huecos (con refDate + ubicod)', async () => {
    mockQuerySuccess();
    await request(app)
      .get(`${BASE_URL}?empkey=1136&refDate=20260301&ubicod=SUCURSAL1`)
      .set('x-api-key', API_KEY);

    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0];

    const placeholders = sql.match(/\$(\d+)/g) || [];
    const usedIndices = new Set(placeholders.map((p: string) => parseInt(p.slice(1))));

    for (let i = 1; i <= params.length; i++) {
      expect(usedIndices.has(i)).toBe(true);
    }
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
