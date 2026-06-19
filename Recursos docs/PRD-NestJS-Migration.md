# PRD: Migración Express → NestJS — POS Dashboard Backend

## Problem Statement

El backend actual es un servidor Express 5 escrito en TypeScript plano, con middlewares imperativos, gestión manual del ciclo de vida de la aplicación y sin convenciones de estructura modular. A medida que el proyecto crece (más endpoints, más reglas de validación, más middlewares), la arquitectura plana dificulta la navegación del código, el testing aislado de capas y la incorporación de nuevos desarrolladores. No hay un contrato claro entre la capa de transporte HTTP, la lógica de negocio y el acceso a datos.

## Solution

Reescribir el backend usando **NestJS** (framework Node.js estructurado con DI, decoradores y módulos) manteniendo exactamente la misma superficie de API (endpoints, contratos request/response) y sin alterar el frontend. La base de datos se accede vía **TypeORM** en modo raw queries (`DataSource.query()`), preservando todas las queries SQL existentes. El test runner cambia de Vitest a **Jest** (el módulo de testing por defecto de NestJS).

La migración reemplaza `/backend` in-place para que el proceso de deploy (`deploy.sh`, PM2, Nginx) no cambie. **El gestor de paquetes es `pnpm`** (reemplaza npm) — todos los comandos del proyecto deben usar `pnpm install`, `pnpm run build`, `pnpm test`, etc.

## User Stories

1. Como desarrollador, quiero que el código del backend esté organizado en módulos NestJS independientes (branches, products, charts) de modo que pueda entender, modificar y testear cada dominio sin afectar los demás.
2. Como desarrollador, quiero que la autenticación por API Key esté encapsulada en un Guard de NestJS, de modo que pueda aplicarla o removerla por controlador con un solo decorador.
3. Como desarrollador, quiero que la validación de `empkey` esté encapsulada en un Pipe de NestJS, de modo que los controladores reciban siempre un entero válido y nunca un string.
4. Como desarrollador, quiero que la caché de 60s esté encapsulada en un Interceptor de NestJS aplicado selectivamente a los endpoints de charts, de modo que los endpoints sin caché (`/branches`, `/products`) no se vean afectados.
5. Como desarrollador, quiero que la configuración de la conexión TypeORM esté en un `DatabaseModule` centralizado, de modo que cualquier módulo pueda inyectar `DataSource` sin reimplementar la lógica de SSL/pool.
6. Como desarrollador, quiero que todos los tests usen Jest + `@nestjs/testing`, de modo que pueda mockear providers individualmente via DI sin depender de mocks globales de módulos.
7. Como desarrollador, quiero que los scripts `pnpm dev`, `pnpm build`, `pnpm test` y `pnpm start` funcionen de la misma manera que los scripts npm anteriores, de modo que `deploy.sh` y los flujos de CI solo necesiten cambiar `npm` → `pnpm`.
8. Como operador, quiero que el endpoint `GET /api/health` siga funcionando y mostrando stats del pool, de modo que pueda verificar la salud del servidor en producción.
9. Como operador, quiero que la configuración de CORS, rate limiting (300 req/15min), headers de seguridad (Helmet) y graceful shutdown se preserve exactamente, de modo que el servidor mantenga el mismo nivel de seguridad y resiliencia.
10. Como desarrollador, quiero que el throttling global sea configurable vía `@nestjs/throttler` en `AppModule`, de modo que no esté hardcodeado en el bootstrap de Express.
11. Como desarrollador, quiero que la lógica de construcción de queries SQL dinámicas (parámetros numerados, condiciones condicionales) esté encapsulada en los Services, de modo que los Controllers no tengan lógica de acceso a datos.
12. Como desarrollador, quiero que `toDayKey()` y las funciones `parseDateParam()`, `parseProductKeys()`, `parseRefDate()` vivan en `common/utils/`, de modo que múltiples services las puedan importar sin duplicación.
13. Como desarrollador, quiero que los archivos de test pasen de `*.test.ts` a `*.spec.ts` siguiendo la convención NestJS, de modo que `jest.config.ts` los detecte automáticamente.
14. Como desarrollador, quiero que el Logger de Winston se configure una sola vez y se inyecte vía NestJS (`nest-winston`), de modo que todos los módulos usen el mismo logger sin importar el singleton directamente.

## Implementation Decisions

### Módulos a construir

| Módulo | Responsabilidad | Profundidad |
|---|---|---|
| `DatabaseModule` | Proveedor de `DataSource` TypeORM (raw queries, sin entidades, lógica SSL) | Deep — encapsula toda la config de PG |
| `ApiKeyGuard` | `CanActivate` — valida `x-api-key` header | Deep — toda la lógica de auth |
| `ParseEmpkeyPipe` | `PipeTransform` — string → number positivo | Deep — toda la validación de empkey |
| `ChartCacheInterceptor` | `NestInterceptor` — caché 60s in-memory por URL | Deep — Map + TTL + cleanup |
| `BranchesModule` | Controller + Service para `/api/branches` | Thin controller, deep service |
| `ProductsModule` | Controller + Service para `/api/products` | Thin controller, deep service |
| `ChartsModule` | Controller + 3 Services (sales-history, top-products, sales-comparison) | Thin controller, deep services |
| `AppModule` | Root: importa todos los módulos, configura ThrottlerModule | Thin |

### Decisiones técnicas

- **pnpm**: Gestor de paquetes oficial del proyecto. `package.json` incluye `"packageManager": "pnpm@9.x"`. Se elimina `package-lock.json` (npm) y se genera `pnpm-lock.yaml`. `deploy.sh` debe actualizarse para usar `pnpm install --frozen-lockfile && pnpm run build`.
- **Seguridad**: Todas las dependencias de NestJS 11 + pnpm deben pasar `pnpm audit` con 0 vulnerabilidades antes de cada deploy.
- **TypeORM raw queries**: `DataSource.query(sql, params)` funciona idénticamente a `pg.Pool.query()` para PostgreSQL — los parámetros `$1, $2, ...` son preservados sin cambios.
- **Sin entidades TypeORM**: Las tablas (`dwpreporte`, `dwpubicacion`, `dwpproducto`) no se definen como entidades. `entities: []` en la config. Solo raw queries.
- **SSL config**: La función `buildSslConfig()` de `db.ts` se copia a `DatabaseModule` — misma lógica `NODE_ENV === 'production' || DB_SSL === 'true'`.
- **Rate limiting**: `ThrottlerModule.forRoot([{ ttl: 900000, limit: 300 }])` reemplaza `express-rate-limit`.
- **Graceful shutdown**: `app.enableShutdownHooks()` en `main.ts` reemplaza el manejo manual de `SIGTERM`/`SIGINT`.
- **Logger**: `nest-winston` como logger global. Los módulos inyectan `Logger` de `@nestjs/common` o el `WINSTON_MODULE_PROVIDER`.
- **Jest config**: Generada por NestJS CLI estándar — `ts-jest`, `testRegex: '.*\\.spec\\.ts$'`, `rootDir: 'src'`.
- **NODE_ENV=test**: `main.ts` exporta `app` y hace `await app.init()` sin `listen()` cuando `NODE_ENV === 'test'`, manteniendo el patrón actual.
- **Global prefix**: `app.setGlobalPrefix('api')` — los controladores usan rutas relativas (`/branches`, `/charts/sales-history`).
- **ValidationPipe global**: `app.useGlobalPipes(new ValidationPipe({ transform: true }))` para pipes de query params.

### Contrato de API (sin cambios)

```
GET /api/branches?empkey=X
GET /api/products?empkey=X
GET /api/charts/sales-history?empkey=X&ubicod=Y&from=YYYYMMDD&to=YYYYMMDD&refDate=YYYYMMDD&products=1,2
GET /api/charts/top-products?empkey=X&ubicod=Y&from=YYYYMMDD&to=YYYYMMDD&products=1,2
GET /api/charts/sales-comparison?empkey=X&ubicod=Y&refDate=YYYYMMDD&products=1,2
GET /api/health
```

Todos los response bodies son idénticos a los actuales.

## Testing Decisions

### Qué constituye un buen test

- Testear **comportamiento externo** (status codes, response body shape) — no detalles de implementación internos del service.
- Mockear solo en la frontera de infraestructura: `DataSource.query` se mockea, nada más.
- Cada spec debe ser independiente (sin estado compartido entre tests).

### Módulos a testear

| Spec file | Qué se testa |
|---|---|
| `branches.controller.spec.ts` | 401 sin key, 400 empkey inválido, 200 con datos, 500 en error DB |
| `products.controller.spec.ts` | Ídem branches |
| `sales-history.controller.spec.ts` | Filtros de fecha, productos, ubicod; comportamiento con/sin params opcionales |
| `top-products.controller.spec.ts` | Orden por total DESC, join con descripción |
| `sales-comparison.controller.spec.ts` | Anchors, lógica de hora actual, refDate |
| `parse-empkey.pipe.spec.ts` | Valores válidos, negativos, cero, strings, undefined |
| `chart-cache.interceptor.spec.ts` | Hit, miss, expiración, cleanup |
| `date.utils.spec.ts` | toDayKey — copia directa de los tests actuales |

### Patrón de test (prior art: tests actuales con supertest)

```typescript
// Patrón NestJS equivalente al actual
beforeAll(async () => {
  const module = await Test.createTestingModule({
    controllers: [BranchesController],
    providers: [BranchesService, { provide: DataSource, useValue: { query: jest.fn() } }],
  }).compile();
  app = module.createNestApplication();
  app.useGlobalGuards(new ApiKeyGuard());
  await app.init();
});

it('401 sin x-api-key', () =>
  request(app.getHttpServer()).get('/branches?empkey=1').expect(401));
```

## Out of Scope

- Cambios al frontend (`/frontend`)
- Cambios al proceso de deploy (`deploy.sh`, configuración Nginx, PM2)
- Migración a TypeORM con entidades (ORM mode) — solo raw queries
- Endpoints nuevos
- OpenAPI/Swagger (puede agregarse luego)
- Autenticación JWT u OAuth
- WebSockets

## Further Notes

- El archivo `deploy.sh` usa PM2 con `npm start` — el script `start` del nuevo `package.json` debe seguir ejecutando el backend desde `dist/`.
- `vite.config.ts` del frontend tiene `base: '/POSdashboard2603/'` — sin relación con este PRD.
- Las queries SQL críticas (especialmente `sales-comparison` con múltiples `CASE WHEN`) deben copiarse textualmente para evitar regresiones.
- La regla de no orphan params (`$N` sin param correspondiente causa error en PostgreSQL) debe preservarse en todos los services.
- `VITE_API_SECRET_KEY` en el frontend es la misma que `API_SECRET_KEY` en el backend — no cambia.

---

## Bullets de implementación (orden sugerido)

> Leyenda: ✅ completado · 🔄 en progreso · [ ] pendiente

1. ✅ **Actualizar `package.json`** — NestJS 11, TypeORM, Jest, pnpm; `pnpm install` exitoso (0 vulnerabilidades)
2. ✅ **Actualizar `tsconfig.json`** — `emitDecoratorMetadata: true`, `experimentalDecorators: true`, target ES2021
3. ✅ **Crear `jest.config.ts`** y eliminar `vitest.config.ts`
4. ✅ **Crear `DatabaseModule`** — DataSource TypeORM con SSL config (migrar lógica de `db.ts`)
5. ✅ **Crear `ApiKeyGuard`** — migrar lógica de `auth.ts`
6. ✅ **Crear `ParseEmpkeyPipe`** — migrar lógica de `validateEmpkey` de `validate.ts`
7. ✅ **Crear `ChartCacheInterceptor`** — migrar lógica de `cache.ts` (fix: `ttlMs` como campo de clase, no param de constructor)
8. ✅ **Migrar utils** — `date.utils.ts` (toDayKey) y funciones parse de `validate.ts` a `common/utils/`
9. ✅ **Crear `BranchesModule`** (controller + service + spec) — 8 tests
10. ✅ **Crear `ProductsModule`** (controller + service + spec) — 8 tests
11. ✅ **Crear `ChartsModule`** — `SalesHistoryService` (controller + service + spec) — 17 tests; IN en lugar de ANY
12. ✅ **Crear `ChartsModule`** — `TopProductsService` (controller + service + spec)
13. ✅ **Crear `ChartsModule`** — `SalesComparisonService` (controller + service + spec)
14. ✅ **Crear `AppModule`** — root con ThrottlerModule, todos los feature modules + HealthController
15. ✅ **Crear `main.ts`** — bootstrap con Helmet, CORS, ValidationPipe, shutdown hooks, nest-winston
16. ✅ **Eliminar archivos Express** — `index.ts`, `db.ts`, `logger.ts`, `middleware/`, `routes/`, `utils/`, `test/`
17. ✅ **Ejecutar `pnpm test`** — 67/67 specs pasando
18. ✅ **Ejecutar `pnpm build`** — sin errores TypeScript
19. ✅ **Actualizar `deploy.sh`** — backend usa `pnpm run build`
