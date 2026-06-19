import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  OnModuleDestroy,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, of, tap } from 'rxjs';

const DEFAULT_TTL = 60_000; // 60 segundos

/**
 * Interceptor de caché en memoria para endpoints de charts.
 * Migrado desde middleware/cache.ts
 *
 * Uso: @UseInterceptors(ChartCacheInterceptor) en el controller de charts
 */
@Injectable()
export class ChartCacheInterceptor implements NestInterceptor, OnModuleDestroy {
  // Campo de clase en lugar de parámetro de constructor — evita que NestJS
  // registre `Number` como dependencia inyectable via emitDecoratorMetadata
  private readonly ttlMs = DEFAULT_TTL;
  private readonly cache = new Map<string, { data: unknown; expiry: number }>();
  private readonly cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    // Limpieza periódica de entradas expiradas (cada 5 min)
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache) {
        if (entry.expiry <= now) this.cache.delete(key);
      }
    }, 5 * 60_000);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const key = request.originalUrl;
    const cached = this.cache.get(key);

    if (cached && cached.expiry > Date.now()) {
      return of(cached.data);
    }

    return next.handle().pipe(
      tap((data) => {
        this.cache.set(key, { data, expiry: Date.now() + this.ttlMs });
      }),
    );
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanupInterval);
  }
}
