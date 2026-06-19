import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, Logger } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import helmet from 'helmet';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { AppModule } from './app.module';

dotenv.config();

const LOG_DIR = process.env.LOG_DIR ?? path.join(__dirname, '..', 'logs');
const IS_PROD = process.env.NODE_ENV === 'production';

const transports: winston.transport[] = [
  new DailyRotateFile({
    dirname: LOG_DIR,
    filename: 'error-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxSize: '10m',
    maxFiles: '30d',
  }),
  new DailyRotateFile({
    dirname: LOG_DIR,
    filename: 'combined-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
  }),
];

if (!IS_PROD) {
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf((info) => {
          const { timestamp, level, message, service, ...meta } = info;
          const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp as string} [${service as string}] ${level}: ${message as string}${extra}`;
        }),
      ),
    }),
  );
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: WinstonModule.createLogger({
      level: IS_PROD ? 'info' : 'debug',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
      defaultMeta: { service: 'pos-backend' },
      transports,
    }),
  });

  // Trust proxy — correcto detrás de Nginx
  app.set('trust proxy', 1);

  // Security headers
  app.use(helmet());

  // CORS — restringido al frontend autorizado
  const allowedOrigin = process.env.FRONTEND_URL;
  if (!allowedOrigin) {
    new Logger('Bootstrap').warn(
      'FRONTEND_URL no está configurada — CORS bloqueará todas las solicitudes',
    );
  }
  app.enableCors({
    origin: allowedOrigin,
    methods: ['GET'],
    credentials: true,
  });

  // Global API prefix
  app.setGlobalPrefix('api');

  // Global pipes
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  // Graceful shutdown (reemplaza SIGTERM/SIGINT manual de index.ts)
  app.enableShutdownHooks();

  const PORT = process.env.PORT ?? 3001;
  await app.listen(PORT);
  new Logger('Bootstrap').log(
    `Backend corriendo en http://localhost:${PORT}`,
    { env: process.env.NODE_ENV ?? 'development' },
  );
}

bootstrap();
