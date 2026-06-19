import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ParamsController } from './params.controller';
import { ParamsService } from './params.service';

const API_KEY = 'test-api-key';

// Helper — builds a valid GeneXus sidecar response
// ValorParametroValor: 'Producto' → topMode '1', 'Categoria' → topMode '2'
function gxResponse(valorParametro: string) {
  return {
    ok: true,
    resultado: {
      Ok: true,
      ParametrosValuesApp: {
        ParametroValueArray: [
          {
            ParametroId: 'DashboardTopMode',
            ParametroJerarquia: 'DashboardTopMode',
            Persistencia: 'Empresa',
            ValorInstanciado: true,
            ValorJerarquia: valorParametro,
            ValorParametroFin: '',
            ValorParametroIni: '',
            ValorParametroValor: valorParametro,
          },
        ],
      },
    },
  };
}

// ─── GROUP 1: sin PARAMS_APP_ID → siempre retorna '1' sin llamar al sidecar ──

describe('GET /api/params — sin sidecar configurado', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.API_SECRET_KEY = API_KEY;
    delete process.env.PARAMS_APP_ID;

    const moduleRef = await Test.createTestingModule({
      controllers: [ParamsController],
      providers: [ParamsService],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── AUTH ──────────────────────────────────────────────────────────────────

  it('401 sin x-api-key', async () => {
    const res = await request(app.getHttpServer()).get('/api/params?empkey=9100');
    expect(res.status).toBe(401);
  });

  // ─── VALIDACIÓN ────────────────────────────────────────────────────────────

  it('400 sin empkey', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/params')
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/empkey/i);
  });

  it('400 con empkey inválido (texto)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/params?empkey=abc')
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(400);
  });

  it('400 con empkey 0', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/params?empkey=0')
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(400);
  });

  it('400 con empkey negativo', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/params?empkey=-1')
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(400);
  });

  // ─── RESPONSE FORMAT (fallback path) ───────────────────────────────────────

  it('200 — retorna topMode "1" cuando PARAMS_APP_ID no está configurado', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/params?empkey=9101')
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ topMode: '1' });
  });

  it('200 — topMode es string, no número', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/params?empkey=9102')
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    expect(typeof res.body.topMode).toBe('string');
    expect(res.body.topMode).not.toBe(1);
  });
});

// ─── GROUP 2: con PARAMS_APP_ID → llama al sidecar ────────────────────────

describe('GET /api/params — con sidecar GeneXus', () => {
  let app: INestApplication;
  let fetchSpy: jest.SpyInstance;

  beforeAll(async () => {
    process.env.API_SECRET_KEY = API_KEY;
    process.env.PARAMS_SIDECAR_URL = 'http://localhost:3002';
    process.env.PARAMS_APP_ID = 'TEST_APP';

    const moduleRef = await Test.createTestingModule({
      controllers: [ParamsController],
      providers: [ParamsService],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    delete process.env.PARAMS_APP_ID;
    delete process.env.PARAMS_SIDECAR_URL;
    await app.close();
  });

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('200 — retorna topMode "1" cuando GeneXus devuelve ValorParametroValor="Producto"', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => gxResponse('Producto'),
    } as Response);

    const res = await request(app.getHttpServer())
      .get('/api/params?empkey=8001')
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ topMode: '1' });
  });

  it('200 — retorna topMode "2" cuando GeneXus devuelve ValorParametroValor="Categoria"', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => gxResponse('Categoria'),
    } as Response);

    const res = await request(app.getHttpServer())
      .get('/api/params?empkey=8002')
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ topMode: '2' });
  });

  it('200 — fallback a "1" cuando el sidecar no responde (network error)', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const res = await request(app.getHttpServer())
      .get('/api/params?empkey=8003')
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ topMode: '1' });
  });

  it('200 — fallback a "1" cuando el sidecar devuelve HTTP 500', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    const res = await request(app.getHttpServer())
      .get('/api/params?empkey=8004')
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ topMode: '1' });
  });

  it('200 — fallback a "1" cuando GeneXus devuelve array vacío (app no configurada)', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        resultado: {
          Ok: true,
          ParametrosValuesApp: { ParametroValueArray: [] },
        },
      }),
    } as Response);

    const res = await request(app.getHttpServer())
      .get('/api/params?empkey=8005')
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ topMode: '1' });
  });

  it('200 — fallback a "1" cuando GeneXus devuelve Ok=false', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: false,
        resultado: { Ok: false, ParametrosValuesApp: { ParametroValueArray: [] } },
      }),
    } as Response);

    const res = await request(app.getHttpServer())
      .get('/api/params?empkey=8006')
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ topMode: '1' });
  });

  it('200 — fallback a "1" cuando ValorParametroValor tiene valor desconocido ("Desconocido")', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => gxResponse('Desconocido'),
    } as Response);

    const res = await request(app.getHttpServer())
      .get('/api/params?empkey=8007')
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ topMode: '1' });
  });
});
