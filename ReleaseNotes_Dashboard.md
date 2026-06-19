## 2026/05/07 (POS Dashboard)

* **Dashboard completo con gráficos POS**
  * Tarjeta Jira
    * PAC-101
    * PAC-102
    * PAC-103
  * Programas Involucrados
    * Frontend (React + Vite + TypeScript)
    * Backend (Express + TypeScript)
    * PostgreSQL
  * Configuraciones necesarias
    * `VITE_API_SECRET_KEY` en `frontend/.env.production`: Debe coincidir con la key del backend destino
    * `API_SECRET_KEY` en `backend/.env`: Hex string de 64 chars generado con `crypto.randomBytes(32)`
    * `FRONTEND_URL` en `backend/.env`: Origen CORS del dominio que sirve el frontend
    * `DATABASE_URL` en `backend/.env`: Connection string PostgreSQL con esquema `pos2407`
  * Impacto:
    * Nueva aplicación web disponible en `https://pos16.qa.andespos.com/POSdashboard2603/`
    * Visualización de ventas con 3 gráficos: historial diario, comparación por períodos, top productos por cobertura
    * KPIs de resumen: venta total, ticket promedio, productos vendidos
    * Filtros por sucursal (`ubicod`), rango de fechas, selección de productos
  * Definición de la solución:
    * Frontend SPA con React + Vite + TypeScript, estilizado con Tailwind CSS (ocean theme). Tres gráficos con Recharts: SalesHistoryChart (línea diaria), SalesComparisonChart (barras comparativas Hoy/Ayer/Semana/Mes/Año), TopProductsChart (pie con cobertura acumulada ≥80%). KPICards con indicadores de venta total, ticket promedio y productos. Filtros: selector de sucursal, datepicker con `react-datepicker` (formato DD/MM/YYYY), selector de productos multi-select. Backend Express 5 con rutas: `/api/branches`, `/api/products`, `/api/charts/sales-history`, `/api/charts/top-products`, `/api/charts/sales-comparison`. Todas las queries scoped por `empkey` (multi-tenant). Autenticación mediante header `x-api-key`. Parámetro opcional `refDate` (YYYYMMDD) para consultar data histórica con corte horario.

* **refDate — consultas con fecha histórica**
  * Tarjeta Jira
    * PAC-104
  * Programas Involucrados
    * Backend
    * Frontend
  * Configuraciones necesarias
    * —
  * Impacto:
    * Las URLs pueden incluir `&refDate=YYYYMMDD` para ver el dashboard como se veía en una fecha pasada
    * Sin `refDate`, la app se comporta exactamente como antes
  * Definición de la solución:
    * Parámetro aditivo no destructivo. `refDate` llega como YYYYMMDD, se parsea con `parseRefDate()`. `isToday` compara contra `new Date()` real (no contra refDate) para activar hourCondition. `currentHour` también viene de `new Date().getHours()` — refDate no tiene hora. `effectiveTo` siempre aplica cota superior: explícita → corte → hoy. `toDayKey` extraído a `backend/src/utils/dateUtils.ts` para compartir entre rutas. En frontend, `parseRefDateString()` en `utils/dateKeys.ts` reemplaza `isValidRefDate()`.

* **Cache middleware + Rate limiter**
  * Tarjeta Jira
    * PAC-105
  * Programas Involucrados
    * Backend
  * Configuraciones necesarias
    * —
  * Impacto:
    * Las respuestas a endpoints GET se cachean por 60 segundos, reduciendo carga en PostgreSQL
    * Rate limit subido de 100 a 300 requests por ventana de 15 minutos
  * Definición de la solución:
    * Middleware `cacheMiddleware` en `backend/src/middleware/cache.ts` con TTL 60s, solo cachea respuestas 2xx, key = `req.originalUrl`. Override de `res.json` para interceptar la respuesta. Limpieza periódica del Map interno cada 60s para prevenir memory leak. Combinado con rate limiter (express-rate-limit) configurado a 300 requests/15 min.

* **Suite de tests automatizados (89 tests)**
  * Tarjeta Jira
    * PAC-106
  * Programas Involucrados
    * Backend
  * Configuraciones necesarias
    * Vitest + Supertest como devDependencies
  * Impacto:
    * 89 tests en 8 archivos: branches (95), products (88), salesHistory (176), salesComparison (242), topProducts (143), cache (108), validate (168), dateUtils (20)
    * Pool de PostgreSQL mockeado, cache desactivado en tests
  * Definición de la solución:
    * Setup de test con `src/test/setup.ts` que mockea `pool`, `logger` y `cacheMiddleware`. `index.ts` exporta `{ app }` y omite `listen()` cuando `NODE_ENV=test`. Tests con Supertest para rutas Express, mocks directos con `vi.fn()` para middlewares. Patrón `mockRes()` para tests unitarios. `vi.importActual` para testear módulos mockeados globalmente.

* **Dark mode con contraste WCAG AA**
  * Tarjeta Jira
    * PAC-107
  * Programas Involucrados
    * Frontend
  * Configuraciones necesarias
    * —
  * Impacto:
    - Dark mode legible con ratios de contraste ≥4.5:1 sobre bg-card (#0c1a35)
    - Theme toggle persiste en localStorage
  * Definición de la solución:
    * 7 fixes de contraste: `--text-very-muted` → #6e8fa8 (ratio 5:1), `--text-label` y `--chart-axis` → #718096 (5.0:1), `badge-neutral` → #8399b0, tooltips y comparación usan `--text-mid`. Colores Recharts en `ThemeContext.tsx` sincronizados con CSS custom properties en `index.css`. Componentes custom de Recharts (CustomizedAxisTick, CustomTooltip) usan `useTheme()` en lugar de colores hardcodeados. Fill decorativo del pie chart separado del color de texto de leyenda.

* **AbortController — cancelación de fetch en cambios de filtro**
  * Tarjeta Jira
    * PAC-108
  * Programas Involucrados
    * Frontend
  * Configuraciones necesarias
    * —
  * Impacto:
    * Los requests cancelados ya no disparan errores falsos al cambiar filtros rápidamente
    * Chrome DevTools muestra "(cancelled)" que es comportamiento esperado
  * Definición de la solución:
    * Cada `useEffect` de fetch crea `new AbortController()`, pasa `controller.signal` al fetch, llama `controller.abort()` en cleanup. `isAbortError()` en `client.ts` distingue cancelaciones de errores reales en el `.catch()`. Patrón aplicado a los 3 charts. `useReducer` con acciones FETCH_START/SUCCESS/ERROR en SalesComparisonChart y TopProductsChart, reemplazando múltiples `useState`.

* **useReducer — estado atómico en charts**
  * Tarjeta Jira
    * PAC-109
  * Programas Involucrados
    * Frontend
  * Configuraciones necesarias
    * —
  * Impacto:
    * Los charts con fetch propio ya no disparan renders redundantes por loading/data/error
    * Elimina lint warning `set-state-in-effect`
  * Definición de la solución:
    * `useReducer` con dispatch atómico en SalesComparisonChart y TopProductsChart: acciones FETCH_START / FETCH_SUCCESS / FETCH_ERROR. Una sola actualización por fase en lugar de 3 setters consecutivos que causaban 3 re-renders. Dashboard.tsx ya usaba este patrón — ahora replicado en todos los charts.

* **TopProducts — cobertura acumulada en lugar de topN fijo**
  * Tarjeta Jira
    * PAC-110
  * Programas Involucrados
    * Frontend
  * Configuraciones necesarias
    * —
  * Impacto:
    * El gráfico de top productos ahora muestra dinámicamente los productos que cubren el 80% del ingreso (hasta 8 slices)
    * Productos restantes se agrupan en "Otros" sin superar el límite de slices
  * Definición de la solución:
    * Se reemplazó el `topN` fijo por `COBERTURA_OBJETIVO=0.80` y `MAX_SLICES=8`. El backend ordena productos por ingreso descendente y calcula cobertura acumulada. El frontend recorta al mínimo número de productos que alcanzan el 80%, y agrupa el resto en una categoría "Otros" solo si caben dentro de MAX_SLICES.

* **Linting Recharts: eliminación de tipos `any`**
  * Tarjeta Jira
    * PAC-111
  * Programas Involucrados
    * Frontend
  * Configuraciones necesarias
    * —
  * Impacto:
    * Zero `any` en componentes de Recharts
    * Tooltips tipados con `TooltipProps<number, number>` y `TooltipProps<number, string>` de Recharts
  * Definición de la solución:
    * `TooltipProps<ValueType, NameType>` importado de Recharts para custom tooltips. Interface local para tick components de XAxis (Recharts no exporta tipo público). `CustomizedAxisTick` sigue el patrón oficial de docs con `...args: any[]` acotado al boundary. `content={<CustomTooltip />}` sin render functions para evitar contravarianza de genéricos.

* **Backend hardening — SSL, graceful shutdown, /health endpoint**
  * Tarjeta Jira
    * PAC-112
  * Programas Involucrados
    * Backend
  * Configuraciones necesarias
    * `DB_SSL=true/false` en `.env`: Activa SSL en conexión PostgreSQL sin cambiar NODE_ENV
    * `DB_SSL_CA` en `.env`: Path al `server.crt` para `rejectUnauthorized: true`
    * `?sslmode=require` en `DATABASE_URL` cuando SSL está activo
  * Impacto:
    * Conexión segura a PostgreSQL con verificación de certificado en producción
    * Pool de conexiones con `min: 2` (conexiones warm)
    * Graceful shutdown en SIGTERM/SIGINT: drena el pool antes de salir
    * Endpoint `/api/health` con métricas: pool total/idle/waiting + uptime
  * Definición de la solución:
    * `backend/src/db.ts`: refactor a `buildSslConfig()` — usa `rejectUnauthorized: true` + CA cert con DB_SSL_CA, fallback a `rejectUnauthorized: false` en QA. Pool con `min: 2, max: 20`. `backend/src/index.ts`: handlers SIGTERM/SIGINT llaman `pool.end()`. Endpoint `/api/health` protegido por auth devuelve `{ status, db: { total, idle, waiting }, uptime }`.

* **Deploy tooling y documentación**
  * Tarjeta Jira
    * PAC-113
  * Programas Involucrados
    * Backend, Frontend, Nginx, PM2
  * Configuraciones necesarias
    * `deploy.sh`: Script de build y deploy automatizado
    * `Manual Deploy Dashboard.md`: Paso a paso para deploy en servidor nuevo
    * `Playbook-Produccion.md`: Procedimiento completo para salida a producción
    * Servidor QA en 10.50.10.5 con PM2 + Nginx
    * `pm2 start ... --cwd /var/www/pos-dashboard/backend`: Obligatorio para que dotenv encuentre `.env`
  * Impacto:
    * Tiempo de deploy reducido de ~30 min a ~2 min con `deploy.sh`
    * Documentación lista para cualquier desarrollador que necesite hacer deploy
  * Definición de la solución:
    * `deploy.sh` orquesta: build backend → build frontend → transferencia → pm2 restart → nginx reload. `Manual Deploy Dashboard.md` documenta paso a paso para servidor nuevo. `Playbook-Produccion.md` detalla FASE 0 a FASE 4 con checklist, placeholders, comandos para producción con servidores separados app+DB. Se descubrió que PM2 sin `--cwd` crashea con "DATABASE_URL no configurada" porque usa home dir como CWD.

* **npm audit — 0 vulnerabilidades**
  * Tarjeta Jira
    * PAC-114
  * Programas Involucrados
    * Backend, Frontend
  * Configuraciones necesarias
    * —
  * Impacto:
    * Backend: 7 paquetes parchados (path-to-regexp 8.3→8.4.2, entre otros)
    * Frontend: 7 paquetes parchados (vite 7.3.1→7.3.2, picomatch 4.0.3→4.0.4, entre otros)
    * Zero vulnerabilidades conocidas en producción
  * Definición de la solución:
    * Merge de 3 PRs de Dependabot más `npm audit fix` en ambos proyectos. Verificación con `npm audit --audit-level=high`.

* **Servidores sandbox + Nginx server_name fix**
  * Tarjeta Jira
    * PAC-115
  * Programas Involucrados
    * Nginx, Backend, Frontend
  * Configuraciones necesarias
    * `server_name` en Nginx debe incluir el FQDN del dominio público
    * `proxy_set_header x-api-key $http_x_api_key` en Nginx externo (obligatorio)
  * Impacto:
    * Dos servidores sandbox (pos16.sb.andespos.com) funcionales conectando a DB QA
    * Fix para 404 en dominio público: Nginx matcheaba `default_server` por falta de `server_name` correcto
  * Definición de la solución:
    * Diagnóstico: curl local al servidor sandbox respondía OK, pero browser → 404 frontend + 401 /health. Causa: Nginx `server_name` solo tenía la IP local, no el dominio público. Fix: agregar `pos16.sb.andespos.com` a `server_name` + `nginx -t && systemctl reload nginx`. El 401 en `/api/health` desde browser es normal (no envía x-api-key automáticamente).
