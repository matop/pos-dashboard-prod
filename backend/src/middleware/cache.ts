import { Request, Response, NextFunction } from 'express';

const cache = new Map<string, { data: unknown; expiry: number }>();
const DEFAULT_TTL = 60_000; // 60 segundos

export function cacheMiddleware(ttlMs = DEFAULT_TTL) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.originalUrl;
    const cached = cache.get(key);

    if (cached && cached.expiry > Date.now()) {
      res.json(cached.data);
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.set(key, { data: body, expiry: Date.now() + ttlMs });
      }
      return originalJson(body);
    };

    next();
  };
}

// Limpieza periódica de entradas expiradas (cada 5 min)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.expiry <= now) cache.delete(key);
  }
}, 5 * 60_000);
