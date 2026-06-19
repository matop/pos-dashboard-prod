import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';

const API_KEY = 'test-api-key';

describe('GET /api/branches', () => {
  let app: INestApplication;
  let mockQuery: jest.Mock;

  beforeAll(async () => {
    process.env.API_SECRET_KEY = API_KEY;
    mockQuery = jest.fn();

    const moduleRef = await Test.createTestingModule({
      controllers: [BranchesController],
      providers: [
        BranchesService,
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
    const res = await request(app.getHttpServer()).get('/api/branches?empkey=1136');
    expect(res.status).toBe(401);
  });

  it('401 con x-api-key incorrecto', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/branches?empkey=1136')
      .set('x-api-key', 'wrong-key');
    expect(res.status).toBe(401);
  });

  // ─── VALIDACIÓN ────────────────────────────────────────────────────────────

  it('400 sin empkey', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/branches')
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/empkey/i);
  });

  it('400 con empkey inválido (texto)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/branches?empkey=abc')
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(400);
  });

  it('400 con empkey negativo', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/branches?empkey=-1')
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(400);
  });

  // ─── RESPONSE FORMAT ───────────────────────────────────────────────────────

  it('200 — retorna branches array', async () => {
    mockQuery.mockResolvedValue([
      { ubicod: 'SUC1', nombre: 'Sucursal Central' },
      { ubicod: 'SUC2', nombre: 'Sucursal Norte' },
    ]);

    const res = await request(app.getHttpServer())
      .get('/api/branches?empkey=1136')
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('branches');
    expect(Array.isArray(res.body.branches)).toBe(true);
    expect(res.body.branches).toHaveLength(2);
    expect(res.body.branches[0]).toHaveProperty('ubicod', 'SUC1');
    expect(res.body.branches[0]).toHaveProperty('nombre', 'Sucursal Central');
  });

  it('200 — array vacío cuando no hay sucursales', async () => {
    mockQuery.mockResolvedValue([]);

    const res = await request(app.getHttpServer())
      .get('/api/branches?empkey=9999')
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.branches).toHaveLength(0);
  });

  // ─── ERROR HANDLING ────────────────────────────────────────────────────────

  it('500 cuando dataSource.query falla', async () => {
    mockQuery.mockRejectedValue(new Error('connection refused'));

    const res = await request(app.getHttpServer())
      .get('/api/branches?empkey=1136')
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Error interno del servidor');
  });
});
