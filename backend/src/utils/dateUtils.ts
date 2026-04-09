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
