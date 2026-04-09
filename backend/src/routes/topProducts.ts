import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { validateEmpkey, parseDateParam, parseProductKeys } from '../middleware/validate';
import logger from '../logger';

const router = Router();

// GET /api/charts/top-products?empkey=X&ubicod=Y&from=YYYYMMDD&to=YYYYMMDD&products=1,2,3
router.get('/', validateEmpkey, async (req: Request, res: Response) => {
  const empkey = (req as any).empkeyParsed as number;
  const { ubicod, from, to, products } = req.query as Record<string, string>;

  const params: unknown[] = [empkey];
  const conditions: string[] = ['r.dwpempkey = $1'];

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

  // Validar fechas
  const fromDate = parseDateParam(from, 'from', res);
  if (fromDate === 'invalid') return;
  if (fromDate !== null) {
    params.push(fromDate);
    conditions.push(`(r.dwphorakey / 100) >= $${params.length}`);
  }

  const toDate = parseDateParam(to, 'to', res);
  if (toDate === 'invalid') return;
  if (toDate !== null) {
    params.push(toDate);
    conditions.push(`(r.dwphorakey / 100) <= $${params.length}`);
  }

  // Validar rango de fechas
  if (fromDate && toDate && (fromDate as number) > (toDate as number)) {
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
      `SELECT r.dwpproductokey AS productokey,
              TRIM(p.dwpproductodescripcion) AS descripcion,
              SUM(r.dwptotalmonto) AS total
       FROM dwpreporte r
       LEFT JOIN dwpproducto p
         ON r.dwpproductokey = p.dwpproductokey AND r.dwpempkey = p.dwpempkey
       ${where}
       GROUP BY r.dwpproductokey, p.dwpproductodescripcion
       ORDER BY total DESC`,
      params
    );
    res.json({
      data: result.rows.map(row => ({
        productokey: Number(row.productokey),
        descripcion: row.descripcion || `Producto ${row.productokey}`,
        total: Number(row.total),
      })),
    });
  } catch (e: any) {
    logger.error('Error en consulta topProducts', { error: e.message, empkey });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
