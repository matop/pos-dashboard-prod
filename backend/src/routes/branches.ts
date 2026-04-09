import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { validateEmpkey } from '../middleware/validate';
import logger from '../logger';

const router = Router();

// GET /api/branches?empkey=X
router.get('/', validateEmpkey, async (req: Request, res: Response) => {
  const empkey = (req as any).empkeyParsed as number;

  try {
    const result = await pool.query(
      `SELECT TRIM(dwpubicod) AS ubicod, TRIM(dwpubinom) AS nombre
       FROM dwpubicacion
       WHERE dwpempkey = $1
       ORDER BY TRIM(dwpubinom)`,
      [empkey]
    );
    res.json({ branches: result.rows });
  } catch (e: any) {
    logger.error('Error en consulta branches', { error: e.message, empkey });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
