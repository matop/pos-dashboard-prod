import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

// Importar la implementación real, saltando el mock global del setup
// (vi.importActual bypasa vi.mock definido en setupFiles)
const { cacheMiddleware } = await vi.importActual<typeof import('./cache')>('./cache');

// Helper: crea un mock de Response con statusCode y json
function mockReqRes(url: string, statusCode = 200) {
  const req = { originalUrl: url } as Request;
  const res = {
    statusCode,
    json: vi.fn(),
  } as unknown as Response;
  // Hacer que res.json sea chainable (Express lo requiere)
  (res.json as ReturnType<typeof vi.fn>).mockReturnValue(res);
  return { req, res };
}

describe('cacheMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('miss: llama next la primera vez', () => {
    const { req, res } = mockReqRes('/api/test?empkey=1');
    const next = vi.fn();

    cacheMiddleware()(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('hit: segunda llamada a la misma URL retorna dato cacheado sin llamar next', () => {
    const url = '/api/cache-hit-test?empkey=2';
    const { req: req1, res: res1 } = mockReqRes(url);
    const { req: req2, res: res2 } = mockReqRes(url);
    const next1 = vi.fn();
    const next2 = vi.fn();
    const testData = { data: [{ total: 12345 }] };

    // Primera llamada — miss, almacena en cache
    const middleware = cacheMiddleware(60_000);
    middleware(req1, res1, next1);
    expect(next1).toHaveBeenCalledOnce();
    // Simular que el route handler llama res.json con datos
    res1.json(testData);

    // Segunda llamada — debe retornar del cache sin llamar next
    middleware(req2, res2, next2);
    expect(next2).not.toHaveBeenCalled();
    expect(res2.json).toHaveBeenCalledWith(testData);
  });

  it('URLs distintas no comparten cache', () => {
    const url1 = '/api/nocache-a?empkey=10';
    const url2 = '/api/nocache-b?empkey=10';
    const { req: req1, res: res1 } = mockReqRes(url1);
    const { req: req2, res: res2 } = mockReqRes(url2);
    const next1 = vi.fn();
    const next2 = vi.fn();

    const middleware = cacheMiddleware(60_000);
    middleware(req1, res1, next1);
    res1.json({ data: 'url1' });

    middleware(req2, res2, next2);
    // url2 nunca fue cacheada → debe llamar next
    expect(next2).toHaveBeenCalledOnce();
  });

  it('respuestas no-2xx no se cachean', () => {
    const url = '/api/error-nocache?empkey=5';
    const { req: req1, res: res1 } = mockReqRes(url, 500);
    const { req: req2, res: res2 } = mockReqRes(url, 200);
    const next1 = vi.fn();
    const next2 = vi.fn();

    const middleware = cacheMiddleware(60_000);
    middleware(req1, res1, next1);
    res1.json({ error: 'Internal error' }); // 500 → no cachear

    // Segunda llamada: no debe tener cache → llama next de nuevo
    middleware(req2, res2, next2);
    expect(next2).toHaveBeenCalledOnce();
  });

  it('entrada expirada actúa como miss', () => {
    const url = '/api/ttl-test?empkey=7';
    const { req: req1, res: res1 } = mockReqRes(url);
    const { req: req2, res: res2 } = mockReqRes(url);
    const next1 = vi.fn();
    const next2 = vi.fn();

    // TTL de 1ms — expira casi inmediatamente
    const middleware = cacheMiddleware(1);
    middleware(req1, res1, next1);
    res1.json({ data: 'stale' });

    // Esperar que el TTL expire
    return new Promise<void>(resolve => {
      setTimeout(() => {
        middleware(req2, res2, next2);
        expect(next2).toHaveBeenCalledOnce(); // expiró → miss
        resolve();
      }, 10);
    });
  });
});
