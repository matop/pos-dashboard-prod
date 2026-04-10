import { describe, it, expect } from 'vitest';
import { toDayKey } from './dateUtils';

describe('toDayKey', () => {
  it('convierte fecha a YYYYMMDD', () => {
    expect(toDayKey(new Date(2026, 2, 1))).toBe(20260301);   // Marzo 1
    expect(toDayKey(new Date(2026, 0, 15))).toBe(20260115);  // Enero 15
    expect(toDayKey(new Date(2025, 11, 31))).toBe(20251231); // Dic 31
  });

  it('padding correcto para meses y días de 1 dígito', () => {
    expect(toDayKey(new Date(2026, 0, 1))).toBe(20260101);  // Enero 1
    expect(toDayKey(new Date(2026, 8, 9))).toBe(20260909);  // Sep 9
  });

  it('maneja año bisiesto', () => {
    // 2024 es bisiesto
    expect(toDayKey(new Date(2024, 1, 29))).toBe(20240229);
  });
});
