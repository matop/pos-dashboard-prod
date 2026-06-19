# PRD — Top Chart Mode: Productos vs Categorías

**Estado:** En progreso — slices #1–#6 completos · #7 bloqueado (pareado GeneXus pendiente)
**Fecha:** 2026-06-05
**Última actualización:** 2026-06-08

---

## Problem Statement

Empresas con catálogos extensos (1300+ productos) experimentan un gráfico de "Top Productos" inutilizable: la slice "Otros" absorbe ~90% del área visible y los productos relevantes quedan ilegibles. El gráfico no comunica información accionable para estas empresas.

---

## Solution

Introducir un modo de visualización configurable por empresa para el card de Top Productos. El modo se lee desde el sistema central de parámetros GeneXus (Api Parametros) usando el parámetro `DASHBOARD_TOP_MODE`:

- **Modo `"1"` (default):** Gráfico de Top Productos — comportamiento actual sin cambios.
- **Modo `"2"`:** Gráfico de Top Categorías — agrupa ventas por el campo `dwpn4catcod` de la tabla `dwpproducto`, eliminando el problema de fragmentación.

El modo es transparente para el usuario final: solo cambia el título del card. Es configurado por el administrador en GeneXus y se aplica automáticamente al cargar el dashboard.

---

## User Stories

1. Como usuario del dashboard de una empresa con muchos productos, quiero ver las ventas agrupadas por categoría, para que el gráfico sea legible y accionable.
2. Como usuario del dashboard de una empresa con pocos productos, quiero seguir viendo el gráfico de Top Productos sin cambios, para no perder el detalle por producto.
3. Como usuario en modo categoría, quiero ver el nombre de la categoría directamente en el gráfico, para identificar sin ambigüedad qué representa cada slice.
4. Como usuario en modo categoría, quiero ver el tooltip con el total en CLP al hacer hover, igual que en modo productos.
5. Como usuario en modo categoría, quiero que la lógica de agrupación "Otros" funcione igual (máx 8 slices, cobertura 80%), para que el gráfico no se sobrecargue con categorías menores.
6. Como usuario en modo categoría, quiero que el título del card diga "Top Categorías" (no "Top Productos"), para saber en qué vista estoy.
7. Como usuario en modo categoría, quiero que el filtro de productos esté deshabilitado, para no generar confusión con un filtro que no aplica.
8. Como usuario en modo productos, quiero que el filtro de productos siga funcionando con normalidad, para no perder funcionalidad existente.
9. Como administrador, quiero configurar el modo en el sistema GeneXus con el parámetro `DASHBOARD_TOP_MODE`, para controlar qué ven los usuarios de mi empresa.
10. Como administrador, quiero que el cambio de modo aplique en la próxima carga del dashboard (máx 5 minutos de delay por cache), sin necesidad de reiniciar ningún servidor.
11. Como administrador, quiero que si el servicio de parámetros no está disponible, el dashboard siga funcionando en modo productos, para que no haya degradación visible.
12. Como operador de múltiples sucursales, quiero que el modo aplique a todas las sucursales de mi empresa por igual, para tener una experiencia consistente.

---

## Implementation Decisions

### Módulos a construir / modificar

#### Backend — módulo nuevo: `ParamsModule` ✅ IMPLEMENTADO (stub)

- Nuevo módulo NestJS con estructura paralela a `BranchesModule`: controller + service + spec.
- Endpoint: `GET /api/params?empkey=X`
- Respuesta: `{ topMode: '1' | '2' }`
- El service llama al endpoint GeneXus `GetParametrosValues` con `ParametroId = "DASHBOARD_TOP_MODE"` y `Empkey`.
- Cache con TTL de 5 minutos (mismo mecanismo que el servicio de parámetros externo).
- Si la llamada a GeneXus falla (timeout, error de red, respuesta `Ok: false`), el service retorna `{ topMode: '1' }` — fallback silencioso, no propaga error al frontend.
- La configuración del host/puerto GeneXus se lee desde variables de entorno (no hardcodeada).
- Requiere `@nestjs/axios` como dependencia.
- Protegido por `ApiKeyGuard` igual que el resto de endpoints.
- **Stub de desarrollo:** mientras el pareado del dispositivo GeneXus no esté completado, el service retorna `{ topMode: '1' }` hardcodeado. El contrato del endpoint no cambia.

#### Backend — módulo existente: `ChartsModule` ✅ IMPLEMENTADO

- Nuevo service: `TopCategoriesService` — misma estructura que `TopProductsService`.
- Query: `GROUP BY TRIM(p.dwpn4catcod)` con `ORDER BY total DESC`.
- El campo `dwpn4catcod` en `dwpproducto` ya contiene el nombre de la categoría — no requiere tabla adicional de lookup.
- No acepta el parámetro `products` (no aplica en modo categoría).
- Acepta los mismos parámetros que `top-products`: `empkey`, `ubicod`, `from`, `to`.
- Nuevo handler en `ChartsController`: `GET /api/charts/top-categories`.
- Respuesta: `{ data: Array<{ categoria: string; total: number }> }`
- Fallback para `dwpn4catcod` nulo: usar string `"Sin categoría"`.

#### Frontend — hook nuevo: `useAppParams` ✅ IMPLEMENTADO

- Ubicación: `src/hooks/useAppParams.ts`
- Interfaz: `useAppParams(empkey: string) → { topMode: '1' | '2'; loading: boolean }`
- Fetchea `GET /api/params?empkey=X` una sola vez al montar (no re-fetcha en cambios de filtros).
- Si la request falla → `topMode: '1'` por defecto.
- Mientras carga → `topMode: '1'` provisorio (no bloquea el render).

#### Frontend — componente nuevo: `TopCategoriesChart` ✅ IMPLEMENTADO

- Ubicación: `src/components/charts/TopCategoriesChart.tsx`
- Replica la estructura de `TopProductsChart`: misma lógica de agrupación "Otros" (`MAX_SLICES = 8`, `COBERTURA_OBJETIVO = 0.80`), mismo tooltip, misma tabla resumen inferior.
- Diferencias respecto a `TopProductsChart`:
  - Título del card: `"Top Categorías"`.
  - No recibe ni usa el prop `products`.
  - Llama a `fetchTopCategories` en lugar de `fetchTopProducts`.
  - El contador en el encabezado muestra `N categorías` en lugar de `N productos`.
- Recibe props: `empkey`, `ubicod`, `timeRange`, `refDate`, `refreshKey`.

#### Frontend — `api/client.ts` ✅ IMPLEMENTADO

- Nuevo tipo: `TopCategoryPoint { categoria: string; total: number }`.
- Nueva función: `fetchTopCategories(params)` — misma firma que `fetchTopProducts` sin el campo `products`.

#### Frontend — `Dashboard.tsx` ✅ IMPLEMENTADO

- Invoca `useAppParams(empkey)` para obtener `topMode`.
- Renderiza condicionalmente:
  - `topMode === '1'` → `<TopProductsChart />` (sin cambios)
  - `topMode === '2'` → `<TopCategoriesChart />`
- El `ProductFilter` se deshabilita visualmente (prop `disabled`) cuando `topMode === '2'`.

### API Contract

```
GET /api/params?empkey={number}
Headers: x-api-key

200 OK
{ "topMode": "1" | "2" }

— Nunca retorna error de servicio al cliente: fallo GeneXus → topMode: "1"
```

```
GET /api/charts/top-categories?empkey={number}&ubicod={string}&from={YYYYMMDD}&to={YYYYMMDD}
Headers: x-api-key

200 OK
{ "data": [{ "categoria": string, "total": number }] }
— Ordenado por total DESC
— dwpn4catcod NULL → "Sin categoría"
```

### Scope del parámetro

- El modo es único por empresa (`empkey`). No varía por sucursal (`ubicod`).
- Cache TTL: 5 minutos en backend. El frontend fetchea en cada carga de página.

---

## Testing Decisions

### Qué hace un buen test aquí

Testear comportamiento externo del endpoint: status HTTP, shape del response, corrección del SQL generado (sin parámetros huérfanos, sin `ANY($N)` array). No mockear el `QueryBuilder` ni la lógica de agrupación interna — esos son detalles de implementación.

### Módulos a testear

#### `GET /api/charts/top-categories` (spec nuevo)

Prior art: `top-products.controller.spec.ts` — usar el mismo patrón (Supertest, `mockQuery`, `ChartCacheInterceptor` real, `empkey` único por test para evitar hits de caché).

Casos a cubrir:
- 401 sin `x-api-key`
- 400 sin `empkey`
- 400 con `empkey` inválido
- 400 con `from` inválido / `from > to` / `ubicod` demasiado largo
- 200 — retorna `{ data: [{ categoria, total }] }` con tipos numéricos correctos
- 200 — `categoria` nula usa fallback `"Sin categoría"`
- Sin parámetros huérfanos (solo `empkey`)
- Sin parámetros huérfanos (todos los filtros)
- 500 cuando `dataSource.query` falla

#### `GET /api/params` (spec nuevo)

Casos a cubrir:
- 401 sin `x-api-key`
- 400 sin `empkey`
- 200 — retorna `{ topMode: '1' }` cuando GeneXus responde correctamente
- 200 — retorna `{ topMode: '1' }` cuando GeneXus falla (fallback silencioso)
- 200 — retorna `{ topMode: '2' }` cuando `ValorParametroValor === '2'`

---

## Out of Scope

- Toggle manual de modo en la UI por parte del usuario final.
- Modo por sucursal (`ubicod`) — el parámetro es único por `empkey`.
- Internacionalización de nombres de categoría.
- Drill-down desde una categoría hacia sus productos.
- Modificación del `ProductFilter` más allá de deshabilitarlo visualmente en modo `"2"`.
- Cambio de tipo de chart (donut → bar, etc.) según el modo.
- Paginación o scroll en la tabla de leyenda del gráfico.

---

## Further Notes

- El campo `dwpn4catcod` contiene en algunos clientes códigos alfanuméricos compactos (ej. `KAVELLA15B5DOHC16VG1996a1998`) en lugar de nombres legibles. El gráfico los muestra tal cual — no hay transformación. Si en el futuro se requiere una tabla de alias, es un cambio aditivo al service.
- La integración con el servicio GeneXus requiere el ZIP `Parameter-device-js.zip` provisto por el equipo externo y el "pareado" del dispositivo. El desarrollo puede avanzar en paralelo usando el stub de `{ topMode: '1' }` hasta que el pareado esté listo.
- Requiere agregar `@nestjs/axios` a `backend/package.json`.
