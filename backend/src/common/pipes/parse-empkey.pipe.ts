import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/**
 * Pipe que convierte el query param `empkey` de string a número entero positivo.
 * Migrado desde middleware/validate.ts → validateEmpkey()
 *
 * Uso: @Query('empkey', ParseEmpkeyPipe) empkey: number
 */
@Injectable()
export class ParseEmpkeyPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    const empkey = parseInt(value, 10);

    if (!value || isNaN(empkey) || empkey <= 0) {
      throw new BadRequestException(
        'empkey requerido y debe ser un número entero positivo',
      );
    }

    return empkey;
  }
}
