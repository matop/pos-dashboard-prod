import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import logger from './logger';
import { authMiddleware } from './middleware/auth';
import branchesRouter from './routes/branches';
import productsRouter from './routes/products';
import salesHistoryRouter from './routes/salesHistory';
import topProductsRouter from './routes/topProducts';
import salesComparisonRouter from './routes/salesComparison';

dotenv.config();

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3001;

// ─── 1. SEGURIDAD: Headers HTTP ─────────────────────────────────────────────
app.use(helmet());

// ─── 2. SEGURIDAD: CORS restringido al frontend autorizado ───────────────────
const allowedOrigin = process.env.FRONTEND_URL;
if (!allowedOrigin) {
  logger.warn('FRONTEND_URL no está configurada — CORS bloqueará todas las solicitudes');
}

app.use(cors({
  origin: allowedOrigin,
  methods: ['GET'],           // Este backend solo necesita GET
  credentials: true,
}));

// ─── 3. SEGURIDAD: Rate Limiting ─────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // ventana de 15 minutos
  max: 100,                   // máximo 100 requests por IP por ventana
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, por favor intente más tarde' },
});
app.use('/api/', limiter);

// ─── 4. PARSEO DE BODY ────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' })); // Limitar tamaño del body

// ─── 5. AUTENTICACIÓN: Todas las rutas /api requieren API Key ────────────────
app.use('/api/', authMiddleware);

// ─── 6. RUTAS ────────────────────────────────────────────────────────────────
app.use('/api/branches', branchesRouter);
app.use('/api/products', productsRouter);
app.use('/api/charts/sales-history', salesHistoryRouter);
app.use('/api/charts/top-products', topProductsRouter);
app.use('/api/charts/sales-comparison', salesComparisonRouter);

// ─── 7. RUTA NO ENCONTRADA ───────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// ─── 8. MANEJO GLOBAL DE ERRORES ─────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Error global no manejado', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ─── 9. INICIO ───────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`Backend corriendo en http://localhost:${PORT}`, { env: process.env.NODE_ENV || 'development' });
});
