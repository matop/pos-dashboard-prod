## 2026/06/18 (POS Dashboard)

* **Migración backend a NestJS**
  * Programas Involucrados
    * Backend (NestJS \+ TypeScript)
  * Configuraciones necesarias
    * Sin cambios en variables de entorno existentes — `PORT`, `DATABASE_URL`, `API_SECRET_KEY`, `FRONTEND_URL` se mantienen igual
  * Impacto:
    * Backend reescrito con NestJS manteniendo los mismos endpoints y contratos de API sin cambios en el frontend
    * Suite de tests ampliada a 106 tests con Jest \+ Supertest (anteriormente 89 con Vitest)
    * Cache por interceptor aplicado a nivel de controlador en lugar de middleware global
    * Rate limiting gestionado por `ThrottlerModule` de NestJS
  * Definición de la solución:
    * Reescritura completa del backend Express.js a NestJS con módulos: `DatabaseModule` (TypeORM DataSource, pool SSL configurable), `BranchesModule`, `ProductsModule`, `ChartsModule`, `ParamsModule`. `ApiKeyGuard` reemplaza el middleware de autenticación. `ChartCacheInterceptor` (TTL 60 s, key = URL completa) reemplaza el cache middleware. `ThrottlerModule` (300 req/15 min) reemplaza `express-rate-limit`. `ValidationPipe` global con `transform: true`. `QueryBuilder` en `src/common/utils/query-builder.ts` centraliza queries parametrizadas con placeholders `$?` auto-numerados, reemplazando el manejo manual de `$N` en todos los services. Nest-winston para logging estructurado. Helmet y CORS configurados en bootstrap (`src/main.ts`).

* **Consumo de parámetros vía sidecar GeneXus**
  * Programas Involucrados
    * Backend (ParamsModule)
    * Frontend (hook `useAppParams`)
  * Configuraciones necesarias
    * **`PARAMS_SIDECAR_URL`** en `backend/.env`: URL base del sidecar (ej. `http://localhost:3002`)
    * **`PARAMS_APP_ID`** en `backend/.env`: identificador de aplicación (ej. `ServidorPOS`). Dejar vacío deshabilita la llamada al sidecar con fallback seguro a `'1'`
  * Impacto:
    * Nuevo endpoint `GET /api/params?empkey=X` que retorna parámetros de configuración leídos desde GeneXus vía sidecar
    * El frontend consulta los parámetros automáticamente al cargar para adaptar el comportamiento del dashboard
    * Si el sidecar no está disponible, el dashboard funciona con valores por defecto sin mostrar error al usuario
  * Definición de la solución:
    * `src/params/` — `ParamsModule`: `ParamsController` expone `GET /api/params`; `ParamsService` llama al sidecar en `:3002/parameter/values?app=ServidorPOS&...` con caché de 5 minutos en memoria, fallback silencioso a `{ topMode: '1' }` ante cualquier error de red o timeout. Frontend: `hooks/useAppParams.ts` — fetch único en mount, retorna `{ topMode: '1' | '2' }` con fallback silencioso ante error. Sidecar operativo en QA en puerto 3002.

* **Top Categorías — nuevo modo de análisis por categoría de producto**
  * Programas Involucrados
    * Backend (ChartsModule — `TopCategoriesService`)
    * Frontend (`TopCategoriesChart`)
  * Configuraciones necesarias
    * `PARAMS_APP_ID=ServidorPOS` en `backend/.env` (requerido para que el sidecar entregue `topMode`)
    * Parámetro **`CategoriaAnalisisPrincipal`** en GeneXus con la categoría principal de análisis (ej. `Departamento`)
    * Requiere que los productos tengan categorías anidadas hasta nivel 4 configuradas correctamente en el maestro de artículos
  * Impacto:
    * Cuando `topMode === '2'` (configurado en GeneXus), el gráfico de Top Productos se reemplaza por Top Categorías
    * Nuevo gráfico que agrupa las ventas por categoría nivel 4 (`dwpn4catnom`) en lugar de por producto individual
    * El selector de productos se deshabilita en modo categorías — el análisis aplica sobre toda la sucursal
  * Definición de la solución:
    * Backend: `GET /api/charts/top-categories?empkey=X&ubicod=Y&from=YYYYMMDD&to=YYYYMMDD` — `TopCategoriesService` agrupa por `TRIM(dwpn4catcod)`. El nombre de categoría se obtiene mediante `LEFT JOIN dwpn4categoriaproducto cat ON TRIM(p.dwpn4catcod) = TRIM(cat.dwpn4catcod) AND cat.empkey = $1` (necesario porque la vista `dwpproducto` solo expone el código de categoría, no el nombre). Frontend: `TopCategoriesChart.tsx` con la misma paleta ocean y soporte dark/light que `TopProductsChart`. `Dashboard.tsx`: cuando `topMode === '2'` renderiza `TopCategoriesChart` en lugar de `TopProductsChart`; `ProductFilter` recibe `disabled={topMode === '2'}`.
