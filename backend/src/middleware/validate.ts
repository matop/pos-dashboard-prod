import { Request, Response, NextFunction } from 'express';

/**
 * Valida que el query param `empkey` exista y sea un entero positivo.
 * Uso: router.get('/', validateEmpkey, async (req, res) => { ... })
 */
export function validateEmpkey(req: Request, res: Response, next: NextFunction): void {
  const raw = req.query.empkey as string;
  const empkey = parseInt(raw, 10);

  if (!raw || isNaN(empkey) || empkey <= 0) {
    res.status(400).json({ error: 'empkey requerido y debe ser un número entero positivo' });
    return;
  }

  // Reemplazamos el valor parseado para que las rutas lo usen directamente
  (req as any).empkeyParsed = empkey;
  next();
}

/**
 * Valida un parámetro de fecha en formato YYYYMMDD.
 * Retorna el número si es válido, o null si falta.
 * Lanza error 400 si está presente pero es inválido.
 */
export function parseDateParam(
  value: string | undefined,
  name: string,
  res: Response
): number | null | 'invalid' {
  if (!value) return null;

  const num = parseInt(value, 10);

  if (isNaN(num) || num < 20000101 || num > 21001231) {
    res.status(400).json({ error: `Parámetro '${name}' debe ser una fecha válida en formato YYYYMMDD` });
    return 'invalid';
  }
  return num;
}

/**
 * Parsea y valida el parámetro `products` (lista de enteros separados por coma).
 */
export function parseProductKeys(value: string | undefined): number[] {
  if (!value) return [];
  return value.split(',').map(Number).filter(n => !isNaN(n) && n > 0);
}


export function parseRefDate(value: string | undefined, res: Response): Date | null | 'invalid' {
  const num = parseDateParam(value, 'refDate', res);
  if (num === 'invalid') return 'invalid';
  if (num === null) return null;
  const year = Math.floor(num / 10000);
  const month = Math.floor((num % 10000) / 100) - 1;
  const day = num % 100;
  return new Date(year, month, day);
}