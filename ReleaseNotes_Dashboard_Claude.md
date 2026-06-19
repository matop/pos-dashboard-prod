## 2026/05/07 (POS Dashboard)

* **Dashboard analítico POS — aplicación completa**
  * Tarjeta Jira
    * DASH-01
  * Programas Involucrados
    * Frontend (React + Vite + TypeScript)
    * Backend (Express.js + TypeScript)
    * PostgreSQL (esquema pos2407)
  * Configuraciones necesarias
    * DashboardPOSUrl parametro del tipo dispositivo, que se puede instanciar a nivel de aplicacion
  * Impacto:
    * Nueva aplicación web disponible en `https://pos16.qa.andespos.com/POSdashboard2603/`
    * Tres gráficos de ventas: historial diario (línea), comparación de períodos Hoy/Ayer/Semana/Mes/Año (barras), top productos por cobertura de ingresos (pie)
    * KPIs: venta total del período, ticket promedio, cantidad de productos vendidos
    * Filtros: selector de sucursal, rango de fechas DD/MM/YYYY, selector de productos multi-select
    * Aislamiento multi-tenant por `empkey`: cada empresa solo ve sus propios datos
  * Definición de la solución:
    * SPA React sin React Router — navegación por sucursal es estado de filtro en `Dashboard.tsx`. Cinco endpoints de API: `/api/branches`, `/api/products`, `/api/charts/sales-history`, `/api/charts/top-products`, `/api/charts/sales-comparison`. Todas las queries filtran por `empkey`. Autenticación por header `x-api-key` validado en middleware antes de llegar a las rutas. Parámetros de fecha validados con formato YYYYMMDD en capa de validación. Recharts para todos los gráficos. Ocean theme con Tailwind CSS + CSS custom properties para dark/light. Fuentes Google: Fraunces (headings), DM Sans (body), DM Mono (mono).

* **refDate — consultas con corte de fecha histórico**
  * Tarjeta Jira
    * DASH-02
  * Programas Involucrados
    * Backend
    * Frontend
  * Configuraciones necesarias
    * Sin configuración adicional — parámetro opcional en URL: `&refDate=YYYYMMDD`
  * Impacto:
    * Las URLs pueden incluir `&refDate=YYYYMMDD` para visualizar el dashboard tal como se veía en una fecha pasada, respetando el corte horario correcto de ese momento
    * Sin `refDate`, el comportamiento es idéntico al anterior
  * Definición de la solución:
    * Parámetro aditivo no destructivo. `isToday` compara siempre contra `new Date()` real (no contra `refDate`) para determinar si aplica `hourCondition` — si `refDate` es un día pasado, ese día ya terminó y no hay horas futuras. `currentHour` también viene de `new Date().getHours()` porque `refDate` llega como `YYYYMMDD` sin componente horaria. `effectiveTo` siempre aplica cota superior: parámetro explícito → corte horario → hoy. `toDayKey` extraída a `backend/src/utils/dateUtils.ts` y compartida entre rutas. `realNow` capturado una sola vez por request para garantizar consistencia entre `isToday` y `currentHour`.

* **Cache de respuestas API + rate limiting**
  * Tarjeta Jira
    * DASH-03
  * Programas Involucrados
    * Backend
  * Configuraciones necesarias
    * Sin configuración adicional — parámetros fijados directamente en el middleware
  * Impacto:
    * Respuestas GET cacheadas en memoria por 60 segundos, reduciendo carga sobre PostgreSQL en picos de uso
    * Rate limit elevado a 300 requests por ventana de 15 minutos (desde 100)
  * Definición de la solución:
    * Middleware `cacheMiddleware` en `backend/src/middleware/cache.ts`. TTL: 60 s. Solo cachea respuestas 2xx. Clave = `req.originalUrl`. Override de `res.json` para interceptar y almacenar la respuesta antes de enviarla al cliente. Limpieza periódica del `Map` interno cada 60 s para prevenir memory leak. Rate limiter con `express-rate-limit` a 300 req/15 min. Cache desactivado automáticamente con `NODE_ENV=test` para no interferir con tests.

* **Suite de tests automatizados — 89 tests**
  * Tarjeta Jira
    * DASH-04
  * Programas Involucrados
    * Backend
  * Configuraciones necesarias
    * `vitest` y `supertest` como devDependencies (incluidos en `package.json`)
  * Impacto:
    * 89 tests en 8 archivos cubriendo todas las rutas y utilidades: branches, products, salesHistory, salesComparison, topProducts, cache, validate, dateUtils
    * Pool PostgreSQL mockeado — no requiere conexión a base de datos para correr
    * `npm test` retorna código de salida no-cero ante cualquier fallo, apto para CI
  * Definición de la solución:
    * Framework Vitest + Supertest. Setup centralizado en `src/test/setup.ts`: mockea `pool`, `logger` y `cacheMiddleware` globalmente antes de cada archivo. `index.ts` exporta `{ app }` y omite `listen()` cuando `NODE_ENV=test`. Patrón `mockRes()` para tests unitarios de middlewares. `vi.fn()` para mocks directos. `vi.importActual` para testear módulos mockeados globalmente en otros contextos.

* **Dark mode con contraste WCAG AA validado**
  * Tarjeta Jira
    * DASH-05
  * Programas Involucrados
    * Frontend
  * Configuraciones necesarias
    * Sin configuración — el toggle persiste automáticamente en `localStorage`
  * Impacto:
    * Dark mode con ratios de contraste ≥ 4.5:1 sobre fondo de card (`#0c1a35`), cumpliendo WCAG 2.2 nivel AA
    * Preferencia de tema persiste entre sesiones del usuario
  * Definición de la solución:
    * 7 correcciones de contraste: `--text-very-muted` → `#6e8fa8` (~5:1), `--text-label` y `--chart-axis` → `#718096` (5.0:1), `badge-neutral` → `#8399b0`, tooltips y sección comparación usan `--text-mid`. Colores Recharts definidos en `ThemeContext.tsx` y sincronizados con CSS custom properties en `index.css`. Componentes custom `CustomizedAxisTick` y `CustomTooltip` consumen `useTheme()` en lugar de colores hardcodeados. Color decorativo del pie chart separado del color de texto de leyenda para evitar heredar el fondo oscuro en el label.

* **Backend hardening — SSL PostgreSQL, graceful shutdown, /health**
  * Tarjeta Jira
    * DASH-06
  * Programas Involucrados
    * Backend
  * Configuraciones necesarias
    * `DB_SSL=true` en `backend/.env`: activa SSL en la conexión PostgreSQL sin cambiar `NODE_ENV`
    * `DB_SSL_CA` en `backend/.env` (opcional): path al `server.crt` para activar `rejectUnauthorized: true`
    * `?sslmode=require` en `DATABASE_URL` cuando SSL está activo
  * Impacto:
    * Conexión a PostgreSQL con SSL verificable por certificado en producción
    * El proceso Node.js drena el pool antes de apagarse (SIGTERM/SIGINT), evitando queries truncadas en reinicios de PM2
    * Endpoint `/api/health` (autenticado) disponible para monitoreo: retorna estado del pool y uptime del proceso
  * Definición de la solución:
    * `backend/src/db.ts`: función `buildSslConfig()` — con `DB_SSL_CA` activa `rejectUnauthorized: true` + CA cert; sin él, `rejectUnauthorized: false` para QA. Pool con `min: 2, max: 20`. `backend/src/index.ts`: handlers `SIGTERM`/`SIGINT` llaman `pool.end()`. Endpoint `GET /api/health` protegido por middleware `auth`, retorna `{ status, db: { total, idle, waiting }, uptime }`.

* **Servidores sandbox operativos — fix Nginx server_name**
  * Tarjeta Jira
    * DASH-07
  * Programas Involucrados
    * Nginx
  * Configuraciones necesarias
    * `server_name` en el bloque Nginx debe incluir el FQDN del dominio público además de la IP local
    * `proxy_set_header x-api-key $http_x_api_key` en `location /api/` del Nginx externo — sin esta línea Nginx elimina el header y el backend devuelve 401
  * Impacto:
    * Dos servidores sandbox (`pos16.sb.andespos.com`) accesibles desde el dominio público, conectando a la DB de QA
  * Definición de la solución:
    * Diagnóstico: `curl` local al sandbox respondía 200 pero el browser retornaba 404 en frontend + 401 en `/api/health`. Causa: `server_name` solo tenía la IP local — las requests del dominio público matcheaban el `default_server` que no tenía configurado el location `/POSdashboard2603/`. Fix: agregar `pos16.sb.andespos.com` al `server_name` + `nginx -t && systemctl reload nginx`. El 401 en `/api/health` desde browser es comportamiento correcto (el browser no envía `x-api-key` automáticamente).

* **Deploy automatizado — scripts y documentación**
  * Tarjeta Jira
    * DASH-08
  * Programas Involucrados
    * Backend, Frontend, PM2, Nginx
  * Configuraciones necesarias
    * `deploy.sh`: ejecutar desde el root del repositorio en la máquina de desarrollo
    * PM2 debe iniciarse con `--cwd /var/www/pos-dashboard/backend` para que dotenv resuelva `.env` desde el directorio correcto
    * Post-deploy WinSCP: `chown -R dashboardapp:dashboardapp dist/` + `chmod 755` dirs + `chmod 644` files + `nginx -t && systemctl reload nginx`
  * Impacto:
    * Deploy reducido de ~30 minutos a ~2 minutos con `deploy.sh`
    * `Manual Deploy Dashboard.md`: paso a paso para servidor nuevo
    * `Playbook-Produccion.md`: procedimiento completo FASE 0–4 para salida a producción con servidores separados (app + DB)
  * Definición de la solución:
    * `deploy.sh` orquesta: build backend → build frontend → transferencia `dist/` → `pm2 restart pos-backend` → `nginx reload`. Bug crítico resuelto: PM2 sin `--cwd` crasheaba con "DATABASE_URL no configurada" porque tomaba el home dir como CWD en lugar del directorio del backend.

* **Resolución de vulnerabilidades npm — 0 vulnerabilidades**
  * Tarjeta Jira
    * DASH-09
  * Programas Involucrados
    * Backend
    * Frontend
  * Configuraciones necesarias
    * Sin configuración adicional
  * Impacto:
    * Backend: 7 paquetes actualizados — incluye `path-to-regexp 8.3.0 → 8.4.2`
    * Frontend: 7 paquetes actualizados — incluye `vite 7.3.1 → 7.3.2`, `picomatch 4.0.3 → 4.0.4`
    * `npm audit --audit-level=high` retorna 0 vulnerabilidades en ambos proyectos
  * Definición de la solución:
    * Merge de 3 PRs automáticos de Dependabot sobre `path-to-regexp` (backend), `vite` y `picomatch` (frontend). `npm audit fix` ejecutado en ambos proyectos post-merge. 89/89 tests verificados tras las actualizaciones.
