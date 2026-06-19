---
description: Revisar 100 productos del CSV categorizado para validar jerarquía, coherencia y reglas críticas. Uso: /revisar-lote [offset]. Ej: /revisar-lote 200 revisa productos 200-299.
---

# Revisor de Lotes — Categorización POS

Revisa un lote de 100 productos del CSV categorizado y valida que cada uno cumpla las reglas críticas de jerarquía.

## Archivos (rutas fijas)

| Archivo | Ruta |
|---|---|
| CSV categorizado (output) | `C:\Users\DesaMato\Downloads\Lista de productos CATEGORIZADA.csv` |
| CSV maestras de categorías | `C:\Users\DesaMato\Downloads\Maestras POS 2407 - BASE_ Categorías 2606 - Maestras POS 2407 - BASE_ Categorías 2606 (1).csv` |
| Script de reglas | `C:\Users\DesaMato\Downloads\categorizar_productos.py` |

## Parámetro de entrada

El argumento del skill es el **offset** (inicio del lote), en múltiplos de 100:
- `/revisar-lote 0` → filas 0–99 (primeras 100)
- `/revisar-lote 100` → filas 100–199
- `/revisar-lote 200` → filas 200–299
- etc.

Si no se provee argumento, usar offset=0 o el siguiente no revisado según historial de sesión.

## Reglas críticas a verificar (en orden de prioridad)

### R1 — Jerarquía coherente (OBLIGATORIO)
El `CATEGORIAPRODUCTOID` es nivel 4. Su padre (nivel 3) y abuelo (nivel 2) están fijos según el árbol en el CSV maestras. NUNCA asignar un nivel-4 con padre/abuelo de otro departamento.

**Cómo verificar:** Buscar el `CATEGORIAPRODUCTOID` en el CSV maestras. Confirmar que el Departamento y Subdepartamento asignados son los que corresponden a ese código. Si el CSV categorizado no incluye columnas de nivel 2/3, deducir desde maestras.

### R2 — Producto bien clasificado por naturaleza
El nombre del producto debe ser coherente con la categoría. Señales de alerta:
- Producto de limpieza categorizado en alimentos
- Bebida alcohólica en bebidas sin alcohol
- Medicamento en higiene personal
- Snack de dulce en categoría de sal, o viceversa

### R3 — Sin catch-all incorrecto
Algunos productos caen en categorías genéricas (`DespensaOtr`, `OtrsCuidPersBell`, etc.) porque ninguna regla específica los capturó. Verificar si merecen una categoría más precisa.

### R4 — Nombre ambiguo → investigar
Si el nombre del producto es ambiguo (marca desconocida, abreviatura, nombre corto), **buscar en web** (Jumbo, Lider Chile) antes de opinar. Reportar hallazgo.

## Proceso de revisión

1. **Leer** el CSV categorizado (columnas: mitemkey, ean, codint, nombre, CATEGORIAPRODUCTOID, CATEGORIAPRODUCTODESCRIPCION)
2. **Leer** el CSV maestras para tener el árbol completo de categorías
3. **Extraer** filas [offset … offset+99], ordenadas por mitemkey
4. **Para cada producto** del lote:
   a. Verificar R1: buscar CATEGORIAPRODUCTOID en maestras y confirmar jerarquía
   b. Verificar R2: ¿el nombre es coherente con la categoría?
   c. Si hay duda → google search el producto en supermercados chilenos (Jumbo, Lider)
   d. Marcar como ✅ OK, ⚠️ REVISAR, o ❌ ERROR
5. **Reportar** en tabla estructurada (ver formato abajo)
6. **Para cada ❌ ERROR o ⚠️ REVISAR**, proponer fix exacto al script

## Formato de reporte

```
## Lote [offset]–[offset+99] — Revisión de categorías

### Resumen
- Total revisados: 100
- ✅ OK: X
- ⚠️ Revisar: Y
- ❌ Error: Z

### Problemas encontrados

| mitemkey | Nombre producto | Cat actual | Problema | Cat sugerida |
|---|---|---|---|---|
| 456 | PRODUCTO EJEMPLO | WrongCat | R2: limpieza en alimentos | CorrectCat |

### Fixes propuestos para categorizar_productos.py

Para cada error, mostrar el cambio exacto de regla a aplicar en el script.
```

## Después del reporte

- Esperar aprobación del usuario antes de editar el script
- Una vez aprobado, aplicar todos los fixes en un solo batch de edits
- Regenerar el CSV con el script tras aplicar fixes
- Verificar que los productos corregidos queden bien en el nuevo CSV

## Árbol de referencia rápida (nivel 2 → nivel 3 → ejemplos nivel 4)

```
Alimentos
  Despensa          → Harinas, AzuEndul, MermMiel, DespensaOtr, Pastas, Arroces...
  AceCondim         → Aceites, Salsas, Aderezos, Caldos...
  ConserEnvas       → ConserMar, ConserCarn, ConserVerd, ConserFrut...
  CarnPesc          → CarnVac, CarnCerd, CarnAve, Pescados, Mariscos...
  CafTeHierb        → Cafes, Tes, Hierbas, CafTeHierbOtr...
  Reposteria        → GalletColac, Chocolates, ChocolDulcCaram, Queques, Tortas...
  AlimentInfnt      → LeForInfnt, AlimBebe...
  LactFresc         → Yoghurts, Quesos, Mantequillas, Cremas, PostLact...
  Congelados        → HeladPost, CongeladOtr...
  PanMasas          → PanMold, PanFrances, PanMasasOtr...
  FrutVerd          → FrutasFrescas, VerdHortal...
  SnacksConf        → SnacksSaladFrutSec, BarrasCereal, GomRegal, MazTost...

BebidasLicores
  Aguas             → AguasMineral, AguasSabor...
  JugosYNectar      → JugosPolvo, JugosNectar, JugosNatural...
  BebidasGas        → GaseosCola, GaseosNaranj, GaseosBebOtr...
  IsotonicEnerg     → Isotonicas, Energeticas...
  BebidasAlcohol    → Cervezas, Vinos, PiscoRon, BebidasAlcOtr...

CuidPers
  HgnOral           → CepDent, PastDent, Colut, HgnOralOtr...
  CuidCapilar       → ShmpAcndr, TintCap, CuidCapOtr...
  CuidPiel          → HidrCorp, ProtSolar, CuidPielOtr...
  OtrsCuidPersBell  → Desodorantes, Afeitado, OtrsCuidPersBellOtr...
  CuidFemIntim      → Toallas, Tampones, CuidFemIntimOtr...

SaludBnestr
  MedOTC            → Analgesicos, Antigrip, VitamSuplem, MedOTCOtr...

LimpiezaAseo
  LimpiezaRopa      → DetergMultiuso, Suavizantes, LimpRopaOtr...
  LimpBaoCoc        → LimpBano, LimpCocina, LavaLoza...
  LimpPisosMuebles  → LimpPisos, Ceras, LimpMuebles...
  AerosolesDesinf   → Insecticidas, Desinfectantes, AerosolesOtr...
  PapelesHogar      → PapHig, PapCocina, ServilPapHogar...
  AccesoriosLimpieza→ Esponjas, Escobas, Escobillones, AccesoriosLimpiezaOtr...

Tabaqueria
  Cigarrillos       → Cigarrillos...
  AccesoriosFumar   → AccesoriosFumarOtr...

Ferreteria
  IluminPilas       → Pilas, IluminPilasOtr...
  JrdnPtio          → JrdnPtioOtr...
  FerreteriaOtr     → FerreteriaOtr...

Mascotas
  HigSldMsct        → HigSldMsctOtr...
```

## Notas del usuario

- Comunicación directa, sin floreos
- Si un producto es ambiguo, buscar en Jumbo/Lider Chile antes de asumir
- La fuente de verdad es el CSV maestras, NO suposiciones por descripción
- Revisar en orden por mitemkey (orden numérico del CSV)
- Ante duda sobre categoría correcta, preguntar antes de proponer fix
