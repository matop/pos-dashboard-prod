# PRD — Sales Comparison: Auto-shift al último cierre

**Estado:** Listo para implementar (próxima sesión)
**Área:** `backend/src/charts/sales-comparison.service.ts` · `frontend/src/components/charts/SalesComparisonChart.tsx`

---

## Problem Statement

El gráfico de Comparación de Ventas muestra "Hoy" como referencia principal. Sin embargo, los datos de ventas solo están disponibles en la base de datos después de las 23:00, cuando el **batch de cierre** carga las transacciones del día en `dwpreporte`. Durante el horario laboral (y también a las 9:00 AM del día siguiente), "Hoy" siempre retorna 0, haciendo que todos los deltas de comparación sean ruido: muestran variaciones contra 0 sin ningún valor informativo.

## Solution

El backend detecta automáticamente si hoy tiene datos. Si no los tiene (el batch de cierre aún no corrió o nunca correrá ese día), usa **ayer** como referencia en lugar de hoy — sin requerir que el usuario pase `refDate` manualmente. Los labels de los anchors se ajustan para reflejar la fecha resuelta. El badge "hasta X:00 hs" desaparece cuando el día de referencia es un día cerrado completo.

## User Stories

1. Como operador de tienda que abre el dashboard a las 9:00 AM, quiero ver la comparación de ventas del día anterior como referencia, para poder analizar el cierre de ayer sin ver un gráfico en cero.

2. Como operador, quiero que los deltas de comparación (▲/▼%) sean significativos desde el momento en que abro el dashboard, para tomar decisiones basadas en datos reales.

3. Como operador, quiero que el badge de hora desaparezca cuando el gráfico muestra un día cerrado, para no confundirme pensando que los datos están truncados.

4. Como operador que pasa `?refDate=YYYYMMDD` en la URL, quiero que mi fecha explícita siempre sea respetada, para poder analizar cualquier día histórico sin que el sistema la sobreescriba.

5. Como operador que abre el dashboard en un día festivo en que ayer no hubo ventas, quiero ver el gráfico con Ayer = 0 (sin buscar más atrás), para que el comportamiento sea predecible.

6. Como operador que accede después de las 23:00 (batch corrido), quiero ver "Hoy" con los datos del día completo y el badge de hora, para validar el cierre del día.

## Implementation Decisions

- **Trigger del auto-shift:** Solo aplica cuando `refDate` no viene explícito en la URL. Si viene, el backend lo honra siempre, sin importar si tiene datos o no.

- **Detección de datos de hoy:** El backend consulta si existe algún registro en `dwpreporte` para el DayKey de hoy (con los filtros de `empkey` y `ubicod` aplicados). Si el resultado es 0, activa el auto-shift.

- **Shift máximo:** Solo 1 día hacia atrás. Si ayer también tiene 0 datos (feriado, negocio cerrado), el chart muestra Ayer = 0 sin seguir buscando.

- **Labels cuando hay auto-shift:** El array de anchors cambia de `["Hoy", "Ayer", "Hace 1 semana", "Hace 1 mes", "Hace 1 año"]` a `["Ayer", "Hace 2 días", "Hace 1 semana", "Hace 1 mes", "Hace 1 año"]`.

- **Contrato de respuesta — `currentHour`:** El campo existente `currentHour: number` se convierte en `currentHour: number | null`. Retorna `null` cuando el día de referencia es un día cerrado completo (auto-shift activo, o refDate explícito en el pasado). El frontend interpreta `null` como "no mostrar badge".

- **Sin campo nuevo en la respuesta:** No se agrega `resolvedRefDate` ni `isToday`. El `currentHour: null` es la única señal necesaria para el frontend.

- **Frontend — badge:** La condición de mostrar el badge cambia de `showBadge = !refDate || refDate === todayKey` a simplemente `currentHour !== null`. El componente no necesita saber si hubo auto-shift.

- **Caché del ChartCacheInterceptor:** No requiere cambios. La clave de caché es la URL completa; dos requests idénticos (sin refDate) que ocurran en el mismo minuto retornarán el mismo resultado cacheado, lo cual es correcto.

## Testing Decisions

Un buen test valida el comportamiento externo observable (labels retornados, currentHour en la respuesta), no la implementación interna de la detección.

**Módulo a testear:** `SalesComparisonService` vía los specs existentes en `src/charts/sales-comparison.controller.spec.ts`.

**Casos a cubrir:**
1. Cuando hoy no tiene datos y no se pasa refDate → la respuesta incluye labels ["Ayer", "Hace 2 días", ...] y `currentHour: null`.
2. Cuando hoy tiene datos y no se pasa refDate → la respuesta incluye labels ["Hoy", "Ayer", ...] y `currentHour: number`.
3. Cuando se pasa `refDate` explícito igual a hoy y hoy no tiene datos → se respeta el refDate, sin auto-shift.
4. Cuando se pasa `refDate` explícito en el pasado → `currentHour: null` y labels desde esa fecha.
5. Cuando hoy y ayer tienen 0 datos → auto-shift a ayer, labels ["Ayer", ...], todos los totales = 0.

**Prior art:** Ver `src/charts/sales-history.controller.spec.ts` para el patrón de mock de DataSource y setup de tests en este módulo.

## Out of Scope

- Shift de más de 1 día hacia atrás (buscar el último día con datos).
- Configuración por parámetro del sidecar (topMode-style) para controlar el comportamiento del auto-shift.
- Cambios en el gráfico de historial de ventas (`SalesHistoryService`).
- Exposición de `resolvedRefDate` en la respuesta para que el frontend muestre la fecha usada.

## Further Notes

- El campo `currentHour` ya existe en la respuesta del endpoint. El cambio de tipo a `number | null` requiere actualizar el tipo `SalesComparisonResult` en `frontend/src/api/client.ts` para que TypeScript no falle en el frontend.
- La lógica de detección de datos de hoy debe reutilizar el `QueryBuilder` con los mismos filtros de `empkey` y `ubicod` para ser consistente con la query principal.
- El badge de hora actual tiene una condición compuesta en el frontend (`!refDate || refDate === todayKey`). Al simplificarla a `currentHour !== null`, se elimina una lógica de fecha duplicada en el cliente.
