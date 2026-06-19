import { Logger, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { readFileSync } from 'fs';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

// Migrated from db.ts — same SSL logic preserved
const buildSslConfig = (): PostgresConnectionOptions['ssl'] => {
  const sslEnabled =
    process.env.NODE_ENV === 'production' || process.env.DB_SSL === 'true';

  if (!sslEnabled) return false;

  if (process.env.DB_SSL_CA) {
    return {
      rejectUnauthorized: true,
      ca: readFileSync(process.env.DB_SSL_CA).toString(),
    };
  }

  // SSL sin verificar cert — válido para QA en red privada
  return { rejectUnauthorized: false };
};

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: (): PostgresConnectionOptions => {
        if (!process.env.DATABASE_URL) {
          new Logger('DatabaseModule').error(
            'FATAL: DATABASE_URL no está configurada',
          );
          process.exit(1);
        }

        return {
          type: 'postgres',
          url: process.env.DATABASE_URL,
          entities: [],
          synchronize: false,
          ssl: buildSslConfig(),
          extra: {
            // Pool settings — preserved from db.ts
            max: 20,
            min: 2,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
          },
        };
      },
    }),
  ],
})
export class DatabaseModule {}
