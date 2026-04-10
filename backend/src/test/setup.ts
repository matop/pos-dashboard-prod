import { vi } from 'vitest';

// Variables de entorno para tests
process.env.NODE_ENV = 'test';
process.env.PORT = '3099';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.API_SECRET_KEY = 'test-api-key-for-vitest';

// Mock del pool de PostgreSQL — nunca toca la DB real
vi.mock('../db', () => {
  const mockQuery = vi.fn();
  return {
    pool: {
      query: mockQuery,
      on: vi.fn(),
    },
  };
});

// Desactivar cache en tests — cada request llega al route handler
vi.mock('../middleware/cache', () => ({
  cacheMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// Silenciar Winston en tests
vi.mock('../logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));
