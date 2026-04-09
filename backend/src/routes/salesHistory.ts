import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { validateEmpkey, parseDateParam, parseProductKeys, parseRefDate } from '../middleware/validate';
import { toDayKey } from '../utils/dateUtils';
import logger from '../logger';

const router = Router();

// GET /api/charts/sales-history?empkey=X&ubicod=Y&from=YYYYMMDD&to=YYYYMMDD&refDate=YYYYMMDD&products=1,2,3
router.get('/', validateEmpkey, async (req: Request, res: Response) => {
  const empkey = (req as any).empkeyParsed as number;
  const { ubicod, from, to, products, refDate: refDateRaw } = req.query as Record<string, string>;

  const params: unknown[] = [empkey];
  const conditions: string[] = ['r.dwpempkey = $1'];

  // Parsear refDate
  const refDateParsed = parseRefDate(refDateRaw, res);
  if (refDateParsed === 'invalid') return;

  // Validar ubicod
  if (ubicod) {
    const trimmed = ubicod.trim();
    if (trimmed.length > 50) {
      res.status(400).json({ error: 'ubicod inválido' });
      return;
    }
    params.push(trimmed);
    conditions.push(`TRIM(r.dwpubicod) = $${params.length}`);
  }

  // Validar from
  const fromDate = parseDateParam(from, 'from', res);
  if (fromDate === 'invalid') return;
  if (fromDate !== null) {
    params.push(fromDate);
    conditions.push(`(r.dwphorakey / 100) >= $${params.length}`);
  }

  // Validar to — jerarquía: to explícito → refDate → hoy
  const toDate = parseDateParam(to, 'to', res);
  if (toDate === 'invalid') return;

  const effectiveTo = toDate ?? (refDateParsed ? toDayKey(refDateParsed) : toDayKey(new Date()));
  params.push(effectiveTo);
  conditions.push(`(r.dwphorakey / 100) <= $${params.length}`);

  // Validar rango
  if (fromDate && (fromDate as number) > effectiveTo) {
    res.status(400).json({ error: "El parámetro 'from' no puede ser mayor que 'to'" });
    return;
  }

  // Validar productos
  const productKeys = parseProductKeys(products);
  if (productKeys.length > 0) {
    params.push(productKeys);
    conditions.push(`r.dwpproductokey = ANY($${params.length})`);
  }

  const where = 'WHERE ' + conditions.join(' AND ');

  try {
    const result = await pool.query(
      `SELECT (r.dwphorakey / 100)::bigint AS day,
              SUM(r.dwptotalmonto) AS total
       FROM dwpreporte r
       ${where}
       GROUP BY (r.dwphorakey / 100)
       ORDER BY (r.dwphorakey / 100)`,
      params
    );
    res.json({
      data: result.rows.map(row => ({
        day: Number(row.day),
        total: Number(row.total),
      })),
    });
  } catch (e: any) {
    logger.error('Error en consulta salesHistory', { error: e.message, empkey });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;