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
const BASE = '/api/charts/top-products';

describe('GET /api/charts/top-products', () => {
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

  it('400 con from inválido', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}?empkey=1136&from=baddate`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(400);
  });

  it('400 con to fuera de rango', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}?empkey=1136&to=19991231`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(400);
  });

  it('400 cuando from > to', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}?empkey=1136&from=20260501&to=20260401`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/from/i);
  });

  it('400 con ubicod demasiado largo', async () => {
    const longUbicod = 'X'.repeat(51);
    const res = await request(app.getHttpServer())
      .get(`${BASE}?empkey=1136&ubicod=${longUbicod}`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(400);
  });

  // ─── RESPONSE FORMAT ───────────────────────────────────────────────────────

  it('200 — retorna data array con productokey, descripcion y total numéricos', async () => {
    mockQuery.mockResolvedValue([
      { productokey: '42', descripcion: 'Empanada', total: '150000' },
      { productokey: '7', descripcion: 'Bebida', total: '90000' },
    ]);

    const res = await request(app.getHttpServer())
      .get(`${BASE}?empkey=4001`)
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toEqual({ productokey: 42, descripcion: 'Empanada', total: 150000 });
    expect(typeof res.body.data[0].productokey).toBe('number');
    expect(typeof res.body.data[0].total).toBe('number');
  });

  it('200 — descripcion nula usa fallback "Producto N"', async () => {
    mockQuery.mockResolvedValue([{ productokey: '99', descripcion: null, total: '5000' }]);

    const res = await request(app.getHttpServer())
      .get(`${BASE}?empkey=4002`)
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.data[0].descripcion).toBe('Producto 99');
  });

  it('200 con from + to válidos', async () => {
    mockQuery.mockResolvedValue([]);
    const res = await request(app.getHttpServer())
      .get(`${BASE}?empkey=4003&from=20260301&to=20260401`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('200 con products — usa IN con params individuales (no ANY array)', async () => {
    mockQuery.mockResolvedValue([]);
    await request(app.getHttpServer())
      .get(`${BASE}?empkey=4004&products=1,2,3`)
      .set('x-api-key', API_KEY);

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/IN \(\$\d+, \$\d+, \$\d+\)/);
    expect(sql).not.toMatch(/ANY/);
    expect(params).toContain(1);
    expect(params).toContain(2);
    expect(params).toContain(3);
  });

  // ─── SQL PARAMETERIZATION ──────────────────────────────────────────────────
  // Empkeys únicos — evita hits de caché del interceptor en tests anteriores

  it('sin params huérfanos — solo empkey', async () => {
    mockQuery.mockResolvedValue([]);
    await request(app.getHttpServer())
      .get(`${BASE}?empkey=5001`)
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
      .get(`${BASE}?empkey=5002&from=20260301&to=20260401&ubicod=SUC1&products=1,2`)
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
      .get(`${BASE}?empkey=6001`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Error interno del servidor');
  });
});
