import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { validateEmpkey, parseProductKeys, parseRefDate } from '../middleware/validate';
import { toDayKey } from '../utils/dateUtils';
import logger from '../logger';

const router = Router();


// GET /api/charts/sales-comparison?empkey=X&ubicod=Y&products=1,2,3
router.get('/', validateEmpkey, async (req: Request, res: Response) => {
  const empkey = (req as any).empkeyParsed as number;
  const { ubicod, refDate: refDateRaw, products } = req.query as Record<string, string>;

  const refDateParsed = parseRefDate(refDateRaw, res);
  if (refDateParsed === 'invalid') return;

  const now = refDateParsed ?? new Date();
  const realNow = new Date();
  const currentHour = realNow.getHours();
  
  // Puntos de comparación histórica
  const minusOneDay   = new Date(now); minusOneDay.setDate(now.getDate() - 1);
  const minusOneWeek  = new Date(now); minusOneWeek.setDate(now.getDate() - 7);
  const minusOneMonth = new Date(now); minusOneMonth.setMonth(now.getMonth() - 1);
  const minusOneYear  = new Date(now); minusOneYear.setFullYear(now.getFullYear() - 1);

  const anchors = [
    { label: 'Hoy',          dayKey: toDayKey(now) },
    { label: 'Ayer',         dayKey: toDayKey(minusOneDay) },
    { label: 'Hace 1 semana', dayKey: toDayKey(minusOneWeek) },
    { label: 'Hace 1 mes',   dayKey: toDayKey(minusOneMonth) },
    { label: 'Hace 1 año',   dayKey: toDayKey(minusOneYear) },
  ];

  const baseParams: unknown[] = [empkey];
  const extraConditions: string[] = [];

  // Validar ubicod
  if (ubicod) {
    const trimmed = ubicod.trim();
    if (trimmed.length > 50) {
      res.status(400).json({ error: 'ubicod inválido' });
      return;
    }
    baseParams.push(trimmed);
    extraConditions.push(`TRIM(r.dwpubicod) = $${baseParams.length}`);
  }

  // Validar productos
  const productKeys = parseProductKeys(products);
  if (productKeys.length > 0) {
    baseParams.push(productKeys);
    extraConditions.push(`r.dwpproductokey = ANY($${baseParams.length})`);
  }

  const extraWhere = extraConditions.length > 0
    ? 'AND ' + extraConditions.join(' AND ')
    : '';

  try {
    const todayDayKey = toDayKey(realNow);
    const dayKeys = anchors.map(a => a.dayKey);
    const params = [...baseParams];

    // Array de dayKeys para pre-filtro WHERE ANY
    params.push(dayKeys);
    const dayKeysIdx = params.length;

    // currentHour para hour filter del anchor "hoy"
    params.push(currentHour);
    const hourIdx = params.length;

    // CASE expression por cada anchor
    const cases: string[] = [];
    const aliases: string[] = [];

    anchors.forEach((anchor, i) => {
      params.push(anchor.dayKey);
      const dkIdx = params.length;
      const alias = `total_${i}`;
      aliases.push(alias);

      if (anchor.dayKey === todayDayKey) {
        cases.push(
          `COALESCE(SUM(CASE WHEN (r.dwphorakey/100)=$${dkIdx} AND (r.dwphorakey%100)<=$${hourIdx} THEN r.dwptotalmonto END),0) AS ${alias}`
        );
      } else {
        cases.push(
          `COALESCE(SUM(CASE WHEN (r.dwphorakey/100)=$${dkIdx} THEN r.dwptotalmonto END),0) AS ${alias}`
        );
      }
    });

    const sql = `
      SELECT ${cases.join(', ')}
      FROM dwpreporte r
      WHERE r.dwpempkey = $1
        ${extraWhere}
        AND (r.dwphorakey/100) = ANY($${dayKeysIdx}::bigint[])
    `;

    const result = await pool.query(sql, params);
    const row = result.rows[0];

    const data = anchors.map((anchor, i) => ({
      label: anchor.label,
      total: Number(row[aliases[i]] ?? 0),
    }));

    res.json({ data, currentHour });
  } catch (e: any) {
    logger.error('Error en consulta salesComparison', { error: e.message, empkey });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
