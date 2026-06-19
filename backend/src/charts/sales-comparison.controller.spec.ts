import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { ChartCacheInterceptor } from '../common/interceptors/chart-cache.interceptor';
import { ChartsController } from './charts.controller';
import { SalesComparisonService } from './sales-comparison.service';
import { SalesHistoryService } from './sales-history.service';
import { TopProductsService } from './top-products.service';
import { TopCategoriesService } from './top-categories.service';

const API_KEY = 'test-api-key';
const BASE = '/api/charts/sales-comparison';

// Mock row con los 5 totales
const MOCK_ROW = {
  total_0: '100000',
  total_1: '90000',
  total_2: '80000',
  total_3: '70000',
  total_4: '60000',
};

describe('GET /api/charts/sales-comparison', () => {
  let app: INestApplication;
  let mockQuery: jest.Mock;

  beforeAll(async () => {
    process.env.API_SECRET_KEY = API_KEY;
    mockQuery = jest.fn();

    const moduleRef = await Test.createTestingModule({
      controllers: [ChartsController],
      providers: [
        SalesHistoryService,
        TopProductsService,
        TopCategoriesService,
        SalesComparisonService,
        ChartCacheInterceptor,
        { provide: getDataSourceToken(), useValue: { query: mockQuery } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockQuery.mockReset();
  });

  // ─── AUTH ──────────────────────────────────────────────────────────────────

  it('401 sin x-api-key', async () => {
    const res = await request(app.getHttpServer()).get(`${BASE}?empkey=1136`);
    expect(res.status).toBe(401);
  });

  it('401 con x-api-key incorrecto', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}?empkey=1136`)
      .set('x-api-key', 'wrong-key');
    expect(res.status).toBe(401);
  });

  // ─── VALIDACIÓN ────────────────────────────────────────────────────────────

  it('400 sin empkey', async () => {
    const res = await request(app.getHttpServer()).get(BASE).set('x-api-key', API_KEY);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/empkey/i);
  });

  it('400 con empkey inválido (texto)', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}?empkey=abc`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(400);
  });

  it('400 con refDate inválido', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}?empkey=1136&refDate=invalid`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(400);
  });

  it('400 con ubicod demasiado largo', async () => {
    const longUbicod = 'A'.repeat(51);
    const res = await request(app.getHttpServer())
      .get(`${BASE}?empkey=1136&ubicod=${longUbicod}`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(400);
  });

  // ─── RESPONSE FORMAT ───────────────────────────────────────────────────────

  it('200 — retorna data (5 items) y currentHour', async () => {
    mockQuery
      .mockResolvedValueOnce([{ cnt: '5' }]) // COUNT: hoy tiene datos → no auto-shift
      .mockResolvedValueOnce([MOCK_ROW]);

    const res = await request(app.getHttpServer())
      .get(`${BASE}?empkey=7001`)
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('currentHour');
    expect(res.body.data).toHaveLength(5);
    expect(typeof res.body.currentHour).toBe('number');
  });

  it('labels son los 5 anchors esperados (hoy con datos)', async () => {
    mockQuery
      .mockResolvedValueOnce([{ cnt: '5' }]) // COUNT: hoy tiene datos → no auto-shift
      .mockResolvedValueOnce([MOCK_ROW]);

    const res = await request(app.getHttpServer())
      .get(`${BASE}?empkey=7002`)
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

  it('totales son numéricos', async () => {
    mockQuery.mockResolvedValue([MOCK_ROW]);

    const res = await request(app.getHttpServer())
      .get(`${BASE}?empkey=7003`)
      .set('x-api-key', API_KEY);

    for (const item of res.body.data) {
      expect(typeof item.total).toBe('number');
    }
    expect(res.body.data[0].total).toBe(100000);
  });

  it('200 con refDate pasado — NO falla con param huérfano', async () => {
    mockQuery.mockResolvedValue([MOCK_ROW]);

    const res = await request(app.getHttpServer())
      .get(`${BASE}?empkey=7004&refDate=20260301`)
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(5);
  });

  it('200 con ubicod', async () => {
    mockQuery.mockResolvedValue([MOCK_ROW]);

    const res = await request(app.getHttpServer())
      .get(`${BASE}?empkey=7005&ubicod=SUCURSAL1`)
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(5);
  });

  it('200 con refDate + ubicod', async () => {
    mockQuery.mockResolvedValue([MOCK_ROW]);

    const res = await request(app.getHttpServer())
      .get(`${BASE}?empkey=7006&refDate=20260301&ubicod=SUCURSAL1`)
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(5);
  });

  it('200 con products — usa IN con params individuales (no ANY array)', async () => {
    mockQuery.mockResolvedValue([MOCK_ROW]);

    await request(app.getHttpServer())
      .get(`${BASE}?empkey=7007&products=1,2,3`)
      .set('x-api-key', API_KEY);

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/IN \(\$\d+, \$\d+, \$\d+\)/);
    expect(sql).not.toMatch(/ANY/);
    expect(params).toContain(1);
    expect(params).toContain(2);
    expect(params).toContain(3);
  });

  it('200 con todos los filtros', async () => {
    mockQuery.mockResolvedValue([MOCK_ROW]);

    const res = await request(app.getHttpServer())
      .get(`${BASE}?empkey=7008&refDate=20260301&ubicod=SUCURSAL1&products=1,2,3`)
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(5);
  });

  // ─── SQL PARAMETERIZATION ──────────────────────────────────────────────────
  // Empkeys únicos — evita hits de caché del interceptor

  it('sin params huérfanos — solo empkey', async () => {
    mockQuery.mockResolvedValue([MOCK_ROW]);
    await request(app.getHttpServer())
      .get(`${BASE}?empkey=8001`)
      .set('x-api-key', API_KEY);

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    const usedIndices = new Set(
      (sql.match(/\$(\d+)/g) ?? []).map((p) => parseInt(p.slice(1))),
    );
    for (let i = 1; i <= (params as unknown[]).length; i++) {
      expect(usedIndices.has(i)).toBe(true);
    }
  });

  it('sin params huérfanos — con refDate pasado (sin hour filter)', async () => {
    mockQuery.mockResolvedValue([MOCK_ROW]);
    await request(app.getHttpServer())
      .get(`${BASE}?empkey=8002&refDate=20260301`)
      .set('x-api-key', API_KEY);

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    const usedIndices = new Set(
      (sql.match(/\$(\d+)/g) ?? []).map((p) => parseInt(p.slice(1))),
    );
    for (let i = 1; i <= (params as unknown[]).length; i++) {
      expect(usedIndices.has(i)).toBe(true);
    }
  });

  it('sin params huérfanos — con refDate + ubicod', async () => {
    mockQuery.mockResolvedValue([MOCK_ROW]);
    await request(app.getHttpServer())
      .get(`${BASE}?empkey=8003&refDate=20260301&ubicod=SUCURSAL1`)
      .set('x-api-key', API_KEY);

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    const usedIndices = new Set(
      (sql.match(/\$(\d+)/g) ?? []).map((p) => parseInt(p.slice(1))),
    );
    for (let i = 1; i <= (params as unknown[]).length; i++) {
      expect(usedIndices.has(i)).toBe(true);
    }
  });

  it('sin params huérfanos — con todos los filtros', async () => {
    mockQuery.mockResolvedValue([MOCK_ROW]);
    await request(app.getHttpServer())
      .get(`${BASE}?empkey=8004&refDate=20260301&ubicod=SUCURSAL1&products=1,2`)
      .set('x-api-key', API_KEY);

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    const usedIndices = new Set(
      (sql.match(/\$(\d+)/g) ?? []).map((p) => parseInt(p.slice(1))),
    );
    for (let i = 1; i <= (params as unknown[]).length; i++) {
      expect(usedIndices.has(i)).toBe(true);
    }
  });

  // ─── ERROR HANDLING ────────────────────────────────────────────────────────

  it('500 cuando dataSource.query falla', async () => {
    mockQuery.mockRejectedValue(new Error('DB error'));

    const res = await request(app.getHttpServer())
      .get(`${BASE}?empkey=9001`)
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Error interno del servidor');
  });

  // ─── AUTO-SHIFT ─────────────────────────────────────────────────────────────

  it('auto-shift: hoy sin datos → labels desde ayer y currentHour null', async () => {
    mockQuery
      .mockResolvedValueOnce([{ cnt: '0' }]) // COUNT: hoy sin datos → auto-shift
      .mockResolvedValueOnce([MOCK_ROW]);

    const res = await request(app.getHttpServer())
      .get(`${BASE}?empkey=9101`)
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.currentHour).toBeNull();
    const labels = res.body.data.map((d: { label: string }) => d.label);
    expect(labels).toEqual([
      'Ayer',
      'Hace 2 días',
      'Hace 1 semana',
      'Hace 1 mes',
      'Hace 1 año',
    ]);
  });

  it('no auto-shift: hoy con datos → labels desde hoy y currentHour number', async () => {
    mockQuery
      .mockResolvedValueOnce([{ cnt: '10' }]) // COUNT: hoy tiene datos → no auto-shift
      .mockResolvedValueOnce([MOCK_ROW]);

    const res = await request(app.getHttpServer())
      .get(`${BASE}?empkey=9102`)
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(typeof res.body.currentHour).toBe('number');
    const labels = res.body.data.map((d: { label: string }) => d.label);
    expect(labels[0]).toBe('Hoy');
  });

  it('refDate explícito hoy → respeta refDate sin llamar COUNT, currentHour number', async () => {
    const today = new Date();
    const todayKey = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

    mockQuery.mockResolvedValueOnce([MOCK_ROW]); // solo el data query, sin COUNT

    const res = await request(app.getHttpServer())
      .get(`${BASE}?empkey=9103&refDate=${todayKey}`)
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(typeof res.body.currentHour).toBe('number');
    const labels = res.body.data.map((d: { label: string }) => d.label);
    expect(labels[0]).toBe('Hoy');
    expect(mockQuery).toHaveBeenCalledTimes(1); // no COUNT detection
  });

  it('refDate explícito en el pasado → currentHour null, sin COUNT', async () => {
    mockQuery.mockResolvedValueOnce([MOCK_ROW]); // solo el data query

    const res = await request(app.getHttpServer())
      .get(`${BASE}?empkey=9104&refDate=20260301`)
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.currentHour).toBeNull();
    expect(mockQuery).toHaveBeenCalledTimes(1); // no COUNT detection
  });

  it('hoy y ayer ambos sin datos → shift a ayer igual (máx 1 día), totales 0', async () => {
    const EMPTY_ROW = { total_0: '0', total_1: '0', total_2: '0', total_3: '0', total_4: '0' };
    mockQuery
      .mockResolvedValueOnce([{ cnt: '0' }]) // COUNT: hoy sin datos → auto-shift (no busca más)
      .mockResolvedValueOnce([EMPTY_ROW]);   // data query: ayer también 0

    const res = await request(app.getHttpServer())
      .get(`${BASE}?empkey=9105`)
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.currentHour).toBeNull();
    const labels = res.body.data.map((d: { label: string }) => d.label);
    expect(labels[0]).toBe('Ayer');
    expect(res.body.data[0].total).toBe(0);
    expect(res.body.data).toHaveLength(5);
  });
});
