import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

const API_KEY = 'test-api-key';

describe('GET /api/products', () => {
  let app: INestApplication;
  let mockQuery: jest.Mock;

  beforeAll(async () => {
    process.env.API_SECRET_KEY = API_KEY;
    mockQuery = jest.fn();

    const moduleRef = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        ProductsService,
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
    const res = await request(app.getHttpServer()).get('/api/products?empkey=1136');
    expect(res.status).toBe(401);
  });

  it('401 con x-api-key incorrecto', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/products?empkey=1136')
      .set('x-api-key', 'wrong-key');
    expect(res.status).toBe(401);
  });

  // ─── VALIDACIÓN ────────────────────────────────────────────────────────────

  it('400 sin empkey', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/products')
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/empkey/i);
  });

  it('400 con empkey inválido (texto)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/products?empkey=abc')
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(400);
  });

  it('400 con empkey negativo', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/products?empkey=-1')
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(400);
  });

  // ─── RESPONSE FORMAT ───────────────────────────────────────────────────────

  it('200 — retorna products array', async () => {
    mockQuery.mockResolvedValue([
      { productokey: 101, descripcion: 'Café Americano' },
      { productokey: 102, descripcion: 'Café Latte' },
    ]);

    const res = await request(app.getHttpServer())
      .get('/api/products?empkey=1136')
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('products');
    expect(Array.isArray(res.body.products)).toBe(true);
    expect(res.body.products).toHaveLength(2);
    expect(res.body.products[0]).toHaveProperty('productokey', 101);
    expect(res.body.products[0]).toHaveProperty('descripcion', 'Café Americano');
  });

  it('200 — array vacío cuando no hay productos', async () => {
    mockQuery.mockResolvedValue([]);

    const res = await request(app.getHttpServer())
      .get('/api/products?empkey=9999')
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(0);
  });

  // ─── ERROR HANDLING ────────────────────────────────────────────────────────

  it('500 cuando dataSource.query falla', async () => {
    mockQuery.mockRejectedValue(new Error('connection refused'));

    const res = await request(app.getHttpServer())
      .get('/api/products?empkey=1136')
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Error interno del servidor');
  });
});
