import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

/**
 * Guard de autenticación por API Key.
 * El cliente debe enviar el header: x-api-key: <API_SECRET_KEY>
 * Migrado desde middleware/auth.ts
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  canActivate(context: ExecutionContext): boolean {
    if (!process.env.API_SECRET_KEY) {
      this.logger.error('API_SECRET_KEY no está configurada');
      throw new InternalServerErrorException(
        'Error de configuración del servidor',
      );
    }

    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey || apiKey !== process.env.API_SECRET_KEY) {
      throw new UnauthorizedException('No autorizado');
    }

    return true;
  }
}
