import { Pool } from 'pg';
import dotenv from 'dotenv';
import logger from './logger';

dotenv.config();

if (!process.env.DATABASE_URL) {
  logger.error('FATAL: DATABASE_URL no está configurada');
  process.exit(1);
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Forzar SSL en producción para encriptar la conexión con la DB
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  // Límites del pool de conexiones
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error('Error inesperado en pool de conexiones', { error: err.message });
});
