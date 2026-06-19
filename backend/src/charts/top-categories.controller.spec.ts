import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { ChartCacheInterceptor } from '../common/interceptors/chart-cache.interceptor';
import { ChartsController } from './charts.controller';
import { SalesComparisonService } from './sales-comparison.service';
import { SalesHistoryService } from './sales-history.service';
import { TopCategoriesService } from './top-categories.service';
import { TopProductsService } from './top-products.service';

const API_KEY = 'test-api-key';
const BASE = '/api/charts/top-categories';

describe('GET /api/charts/top-categories', () => {
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
    const res = await request(app.getHttpServer()).get(`${BASE}?empkey=7100`);
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

  it('400 con from inválido', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}?empkey=7101&from=baddate`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(400);
  });

  it('400 cuando from > to', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}?empkey=7102&from=20260501&to=20260401`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/from/i);
  });

  it('400 con ubicod demasiado largo', async () => {
    const longUbicod = 'X'.repeat(51);
    const res = await request(app.getHttpServer())
      .get(`${BASE}?empkey=7103&ubicod=${longUbicod}`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(400);
  });

  // ─── RESPONSE FORMAT ───────────────────────────────────────────────────────

  it('200 — retorna data array con categoria y total', async () => {
    mockQuery.mockResolvedValue([
      { categoria: 'Bebidas', total: '250000' },
      { categoria: 'Comidas', total: '180000' },
    ]);

    const res = await request(app.getHttpServer())
      .get(`${BASE}?empkey=7104`)
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toEqual({ categoria: 'Bebidas', total: 250000 });
    expect(typeof res.body.data[0].categoria).toBe('string');
    expect(typeof res.body.data[0].total).toBe('number');
  });

  it('200 — categoria nula usa fallback "Sin categoría"', async () => {
    mockQuery.mockResolvedValue([{ categoria: null, total: '5000' }]);

    const res = await request(app.getHttpServer())
      .get(`${BASE}?empkey=7105`)
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.data[0].categoria).toBe('Sin categoría');
  });

  // ─── SQL PARAMETERIZATION ──────────────────────────────────────────────────
  // Empkeys únicos (71xx–79xx) — evita hits de caché del interceptor

  it('sin params huérfanos — solo empkey', async () => {
    mockQuery.mockResolvedValue([]);
    await request(app.getHttpServer())
      .get(`${BASE}?empkey=7201`)
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
    mockQuery.mockResolvedValue([]);
    await request(app.getHttpServer())
      .get(`${BASE}?empkey=7202&from=20260301&to=20260401&ubicod=SUC1`)
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
      .get(`${BASE}?empkey=7301`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Error interno del servidor');
  });
});
