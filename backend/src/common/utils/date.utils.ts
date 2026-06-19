import { BadRequestException } from '@nestjs/common';

/**
 * Migrado desde utils/dateUtils.ts y middleware/validate.ts
 */

/**
 * Convierte una fecha a su clave numérica YYYYMMDD.
 * dwphorakey tiene formato YYYYMMDDHH, por lo que:
 *   - dwphorakey / 100  → YYYYMMDD  (día)
 *   - dwphorakey % 100  → HH        (hora, 0-23)
 */
export function toDayKey(date: Date): number {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return parseInt(`${y}${m}${d}`);
}

/**
 * Parsea y valida un parámetro de fecha en formato YYYYMMDD.
 * Retorna el número si es válido, null si falta, o lanza BadRequestException si es inválido.
 * Migrado desde middleware/validate.ts → parseDateParam()
 */
export function parseDateParam(
  value: string | undefined,
  name: string,
): number | null {
  if (!value) return null;

  const num = parseInt(value, 10);

  if (isNaN(num) || num < 20000101 || num > 21001231) {
    throw new BadRequestException(
      `Parámetro '${name}' debe ser una fecha válida en formato YYYYMMDD`,
    );
  }

  return num;
}

/**
 * Parsea y valida el parámetro `products` (lista de enteros positivos separados por coma).
 * Migrado desde middleware/validate.ts → parseProductKeys()
 */
export function parseProductKeys(value: string | undefined): number[] {
  if (!value) return [];
  return value
    .split(',')
    .map(Number)
    .filter((n) => !isNaN(n) && n > 0);
}

/**
 * Parsea el parámetro `refDate` (YYYYMMDD) y lo convierte a Date.
 * Retorna null si falta, lanza BadRequestException si es inválido.
 * Migrado desde middleware/validate.ts → parseRefDate()
 */
export function parseRefDate(value: string | undefined): Date | null {
  const num = parseDateParam(value, 'refDate');
  if (num === null) return null;

  const year = Math.floor(num / 10000);
  const month = Math.floor((num % 10000) / 100) - 1;
  const day = num % 100;
  return new Date(year, month, day);
}
