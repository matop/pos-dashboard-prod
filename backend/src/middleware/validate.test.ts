import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { validateEmpkey, parseDateParam, parseProductKeys, parseRefDate } from './validate';

// Helper: mock de Express Response
function mockRes() {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

// Helper: mock de Express Request con query params
function mockReq(query: Record<string, string> = {}): Request {
  return { query } as unknown as Request;
}

// ─── validateEmpkey ────────────────────────────────────────────────────────
describe('validateEmpkey', () => {
  it('llama next con empkey válido', () => {
    const req = mockReq({ empkey: '1136' });
    const res = mockRes();
    const next: NextFunction = vi.fn();

    validateEmpkey(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect((req as any).empkeyParsed).toBe(1136);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('400 sin empkey', () => {
    const req = mockReq({});
    const res = mockRes();
    const next: NextFunction = vi.fn();

    validateEmpkey(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringMatching(/empkey/i) }));
    expect(next).not.toHaveBeenCalled();
  });

  it('400 con empkey no numérico', () => {
    const req = mockReq({ empkey: 'abc' });
    const res = mockRes();
    const next: NextFunction = vi.fn();

    validateEmpkey(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('400 con empkey = 0', () => {
    const req = mockReq({ empkey: '0' });
    const res = mockRes();
    const next: NextFunction = vi.fn();

    validateEmpkey(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('400 con empkey negativo', () => {
    const req = mockReq({ empkey: '-5' });
    const res = mockRes();
    const next: NextFunction = vi.fn();

    validateEmpkey(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });
});

// ─── parseDateParam ────────────────────────────────────────────────────────
describe('parseDateParam', () => {
  it('retorna null cuando value es undefined', () => {
    const res = mockRes();
    expect(parseDateParam(undefined, 'from', res)).toBeNull();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('retorna el número para una fecha válida', () => {
    const res = mockRes();
    expect(parseDateParam('20260301', 'from', res)).toBe(20260301);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('retorna invalid y 400 para texto no numérico', () => {
    const res = mockRes();
    expect(parseDateParam('baddate', 'from', res)).toBe('invalid');
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('retorna invalid para fecha fuera de rango (antes de 20000101)', () => {
    const res = mockRes();
    expect(parseDateParam('19991231', 'to', res)).toBe('invalid');
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('retorna invalid para fecha fuera de rango (después de 21001231)', () => {
    const res = mockRes();
    expect(parseDateParam('21010101', 'to', res)).toBe('invalid');
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('el mensaje de error contiene el nombre del parámetro', () => {
    const res = mockRes();
    parseDateParam('invalid', 'refDate', res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.stringContaining('refDate'),
    }));
  });
});

// ─── parseProductKeys ──────────────────────────────────────────────────────
describe('parseProductKeys', () => {
  it('retorna [] cuando value es undefined', () => {
    expect(parseProductKeys(undefined)).toEqual([]);
  });

  it('retorna [] para string vacío', () => {
    expect(parseProductKeys('')).toEqual([]);
  });

  it('parsea una lista de enteros', () => {
    expect(parseProductKeys('1,2,3')).toEqual([1, 2, 3]);
  });

  it('filtra entradas no numéricas', () => {
    expect(parseProductKeys('1,abc,3')).toEqual([1, 3]);
  });

  it('filtra ceros y negativos', () => {
    expect(parseProductKeys('0,-1,5')).toEqual([5]);
  });

  it('maneja un solo producto', () => {
    expect(parseProductKeys('42')).toEqual([42]);
  });
});

// ─── parseRefDate ──────────────────────────────────────────────────────────
describe('parseRefDate', () => {
  it('retorna null cuando value es undefined', () => {
    const res = mockRes();
    expect(parseRefDate(undefined, res)).toBeNull();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('retorna un Date para fecha válida', () => {
    const res = mockRes();
    const result = parseRefDate('20260301', res);
    expect(result).toBeInstanceOf(Date);
    expect((result as Date).getFullYear()).toBe(2026);
    expect((result as Date).getMonth()).toBe(2); // marzo = 2
    expect((result as Date).getDate()).toBe(1);
  });

  it('retorna invalid y 400 para fecha inválida', () => {
    const res = mockRes();
    expect(parseRefDate('notadate', res)).toBe('invalid');
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
