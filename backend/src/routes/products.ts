import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { validateEmpkey } from '../middleware/validate';
import logger from '../logger';

const router = Router();

// GET /api/products?empkey=X
router.get('/', validateEmpkey, async (req: Request, res: Response) => {
  const empkey = (req as any).empkeyParsed as number;

  try {
    const result = await pool.query(
      `SELECT dwpproductokey AS productokey, TRIM(dwpproductodescripcion) AS descripcion
       FROM dwpproducto
       WHERE dwpempkey = $1
       ORDER BY TRIM(dwpproductodescripcion)`,
      [empkey]
    );
    res.json({ products: result.rows });
  } catch (e: any) {
    logger.error('Error en consulta products', { error: e.message, empkey });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
