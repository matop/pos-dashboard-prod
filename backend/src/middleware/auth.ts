import { Request, Response, NextFunction } from 'express';
import logger from '../logger';

/**
 * Middleware de autenticación por API Key.
 * El cliente debe enviar el header: x-api-key: <API_SECRET_KEY>
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'];

  if (!process.env.API_SECRET_KEY) {
    logger.error('API_SECRET_KEY no está configurada');
    res.status(500).json({ error: 'Error de configuración del servidor' });
    return;
  }

  if (!apiKey || apiKey !== process.env.API_SECRET_KEY) {
    res.status(401).json({ error: 'No autorizado' });
    return;
  }

  next();
}
