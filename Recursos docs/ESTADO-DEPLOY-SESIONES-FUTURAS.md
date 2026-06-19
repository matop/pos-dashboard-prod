# POS Dashboard — Estado del Deploy y Contexto para Sesiones Futuras
> Última actualización: 19 Jun 2026 (sesión 2)

---

## Estado actual del proyecto

| Componente | Estado | Nota clave |
|-----------|--------|------------|
| App QA completa | ✅ Funcional | https://pos16.qa.andespos.com/POSdashboard2603/ |
| Backend NestJS + PM2 | ✅ Online en QA | dist/main.js · 111/111 tests · health OK · class-validator 0.15.1 |
| Frontend dist/ + Nginx | ✅ Servido | Nginx interno 10.50.10.5 + Nginx externo pos16.qa.andespos.com |
| DB PostgreSQL | ✅ Conectada | localhost:5432 · DB: pos · schema: pos2407 |
| Tests backend | ✅ 111/111 | Jest + Supertest · `cd backend && pnpm test` |
| PRD Architecture Deepening | ✅ Completo | R1+R2+R3+R4+R5 todos implementados |
| PRD Top Chart Mode | ✅ Completo | Slices #1–#7 completos · GeneXus integrado |
| Sidecar parameter-device en QA | ✅ Online | Puerto 3002 · responde DashboardTopMode · backend .env OK |
| Frontend dist/ Top Chart Mode | ✅ Desplegado en QA | Verificado 18 Jun 2026 · ambos dashboards funcionando |
| Top Categories — nombres completos | ✅ Desplegado en QA | JOIN a dwpn4categoriaproducto (vista) para resolver dwpn4catnom · fix 500 post-deploy · 18 Jun 2026 |
| PRD Sales Comparison Auto-shift | ✅ Implementado · ⏳ pendiente deploy QA | `backend/src/charts/sales-comparison.service.ts` · 111/111 tests · 19 Jun 2026 |
| CONTEXT.md (glosario de dominio) | ✅ Creado | Glosario canónico del proyecto en raíz · 19 Jun 2026 |
| GET /api/charts/top-categories | ✅ Implementado | TopCategoriesService + 11 tests · JOIN dwpn4categoriaproducto · GROUP BY catcod, SELECT catnom |
| GET /api/params | ✅ Implementado (GeneXus real) | Llama sidecar :3002 · caché 5 min · fallback '1' · 13 tests · PARAMS_APP_ID=ServidorPOS confirmado |
| TopCategoriesChart + useAppParams | ✅ Implementado | Render condicional en Dashboard · ProductFilter disabled en modo 2 |
| DB connection SSL (SV Sandbox→QA CONF) | ⏳ Bloqueado infra | DatabaseModule listo con `DB_SSL=true` · falta port forwarding TCP 5432 en NAT QA CONF |
| Playbook PostgreSQL prod | ✅ Listo | `Recursos docs/Playbook-PostgreSQL-Produccion.md` |
| pos-prod-sim (192.168.56.101) | ✅ Online | PM2 startup ok · depende de túnel PuTTY en Windows |
| Dark mode WCAG AA | ✅ Auditado | 7 fixes contraste · todos ≥4.5:1 sobre bg-card |
| Servidor QA — limpieza | ✅ Limpio | Sin `src/` en frontend ni backend · permisos corregidos |
| Playbook Producción | ✅ Listo | `Recursos docs/Playbook-Produccion.md` · falta completar placeholders |
| HTTPS / Certbot | ⏳ Pospuesto | Riesgo Nginx externo + panel embedded |
| Token Tomcat | ⏳ Bloqueado | Pendiente definición con dev senior |
| Servidores sandbox (2 sv) | ✅ Online | pos16.sb.andespos.com · app conectada a DB QA · Nginx server_name fix aplicado |

---

## Servidores involucrados

| Servidor | IP / Dominio | Rol | Acceso |
|---------|-------------|-----|--------|
| VM desarrollo | 192.168.56.99 | Origen del build, testing | SSH + WinSCP |
| Servidor QA | 10.50.10.5 (qa-pos16) | App + DB | SSH + WinSCP |
| Proxy externo | pos16.qa.andespos.com | Nginx reverse proxy + HTTPS | Solo 1 compañero |
| Sandbox sv 1 (pos16-sb) | pos16.sb.andespos.com | App sandbox (conecta a DB QA) | SSH como root |
| Sandbox sv 2 | (segunda IP sandbox) | App sandbox (conecta a DB QA) | SSH como root |

---

## URLs de acceso

```
# URL pública QA (funcional)
https://pos16.qa.andespos.com/POSdashboard2603/?empkey=1136
https://pos16.qa.andespos.com/POSdashboard2603/?empkey=1136&ubicod=PILARQUEZADASUC2
https://pos16.qa.andespos.com/POSdashboard2603/?empkey=1136&refDate=20260301

# Acceso directo interno (testing)
http://10.50.10.5/POSdashboard2603/?empkey=1136
```

---

## Variables de entorno — backend .env

```env
PORT=3001
NODE_ENV=production
DATABASE_URL=postgresql://postgres:postgres1267!@localhost:5432/pos
FRONTEND_URL=https://pos16.qa.andespos.com
API_SECRET_KEY=5ae939a89529c096128578c1048ed3ac1c07e6f8dd62e1f29395ad29ea9e36a6
PARAMS_SIDECAR_URL=http://localhost:3002
PARAMS_APP_ID=ServidorPOS                  # ← confirmado 08 Jun 2026 via curl al sidecar
```

> ⚠️ `API_SECRET_KEY` debe ser idéntica a `VITE_API_SECRET_KEY` en el frontend `.env`.
> Si `PARAMS_APP_ID` está vacío, `GET /api/params` retorna `{ topMode: '1' }` sin llamar al sidecar — comportamiento seguro mientras no esté configurado.
> Generar con: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

---

## Estructura en servidor QA (10.50.10.5)

```
/var/www/pos-dashboard/
├── backend/
│   ├── dist/          ← compilado TypeScript (transferido desde VM)
│   ├── node_modules/  ← generado con pnpm install --prod
│   └── .env           ← credenciales producción (chmod 600)
└── frontend/
    └── dist/          ← build React con base='/POSdashboard2603/'
```

**Usuario dueño:** `dashboardapp`
**Permisos:** directorios 755, archivos 644, .env 600

---

## Nginx interno — config activa (10.50.10.5)

**Archivo:** `/etc/nginx/sites-available/pos-dashboard`
**Symlink:** `/etc/nginx/sites-enabled/pos-dashboard`

```nginx
server {
    listen 80;
    server_name pos16.qa.andespos.com 10.50.10.5 localhost;

    location /POSdashboard2603/api/ {
        proxy_pass http://localhost:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /POSdashboard2603/ {
        alias /var/www/pos-dashboard/frontend/dist/;
        index index.html;
        try_files $uri $uri/ /POSdashboard2603/index.html;
    }

    location /api/ {
        proxy_pass http://localhost:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    }

    location / {
        root /var/www/pos-dashboard/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}
```

---

## Nginx externo — config aplicada (pos16.qa.andespos.com)

```nginx
location /POSdashboard2603/api/ {
    proxy_pass         http://10.50.10.5:3001/api/;
    proxy_http_version 1.1;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
    proxy_set_header   x-api-key         $http_x_api_key;  # ← CRÍTICO
}

location /POSdashboard2603/ {
    proxy_pass         http://10.50.10.5/POSdashboard2603/;
    proxy_http_version 1.1;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
    proxy_connect_timeout 10s;
    proxy_read_timeout    30s;
}
```

> ⚠️ `proxy_set_header x-api-key $http_x_api_key` es **obligatorio**.
> Sin esta línea, Nginx externo elimina los headers custom y el backend devuelve 401.

---

## Comandos de operación diaria

```bash
# ── Estado general ───────────────────────────────────────────
sudo -u dashboardapp HOME=/home/dashboardapp pm2 status
sudo systemctl status nginx

# ── Logs en tiempo real ──────────────────────────────────────
sudo -u dashboardapp HOME=/home/dashboardapp pm2 logs pos-backend --lines 50

# ── Redeploy (cuando llegue nuevo build desde VM) ────────────
bash /var/www/pos-dashboard/deploy-servidor-nuevo.sh

# ── Rebuild (solo desde VM dev, no en servidor) ───────────────
# El backend usa pnpm. Nunca buildear directamente en el servidor.
# Construir en VM dev y subir dist/ via deploy.sh o WinSCP.

# ── Reiniciar backend tomando NUEVAS variables de entorno ─────
sudo -u dashboardapp HOME=/home/dashboardapp pm2 restart pos-backend --update-env

# ── Recargar Nginx sin downtime ──────────────────────────────
sudo nginx -t && sudo systemctl reload nginx

# ── Pruebas rápidas desde terminal ──────────────────────────
curl -I http://localhost/POSdashboard2603/
curl http://localhost/POSdashboard2603/api/branches?empkey=1136 \
  -H "x-api-key: $(grep API_SECRET_KEY /var/www/pos-dashboard/backend/.env | cut -d'=' -f2)"

# ── Prueba con refDate ───────────────────────────────────────
curl "http://localhost/POSdashboard2603/api/charts/sales-comparison?empkey=1136&refDate=20260301" \
  -H "x-api-key: $(grep API_SECRET_KEY /var/www/pos-dashboard/backend/.env | cut -d'=' -f2)"
```

---

## Fix 404 después de deploy manual WinSCP

**Síntoma:** Se subieron `backend/dist/` y/o `frontend/dist/` via WinSCP sin ejecutar `deploy.sh`. El browser muestra 404.

**Causa raíz:** pm2 y Nginx no se restartearon — siguen sirviendo el código viejo en memoria.

- **pm2** carga `backend/dist/main.js` en memoria al arrancar y no lo relee automáticamente al sobreescribirse el archivo.
- **Nginx/browser**: Vite genera nombres con content hash (e.g. `assets/index-Ab1c.js`). El nuevo `index.html` referencia los nuevos hashes. Si Nginx o el browser devuelven el viejo `index.html`, los assets con hash nuevo no existen → 404.

### Fix completo (SSH en 10.50.10.5)

WinSCP sube archivos con el usuario SSH del operador, no con `dashboardapp`. Hay que corregir permisos antes de recargar servicios.

```bash
# 1. Corregir dueño y permisos (ajustar según qué subiste)
# Si subiste frontend/dist/:
sudo chown -R dashboardapp:dashboardapp /var/www/pos-dashboard/frontend/dist/
sudo find /var/www/pos-dashboard/frontend/dist/ -type d -exec chmod 755 {} \;
sudo find /var/www/pos-dashboard/frontend/dist/ -type f -exec chmod 644 {} \;

# Si subiste backend/dist/:
sudo chown -R dashboardapp:dashboardapp /var/www/pos-dashboard/backend/dist/
sudo find /var/www/pos-dashboard/backend/dist/ -type d -exec chmod 755 {} \;
sudo find /var/www/pos-dashboard/backend/dist/ -type f -exec chmod 644 {} \;

# 2. Verificar estado pm2
sudo -u dashboardapp HOME=/home/dashboardapp pm2 status

# 3. Reiniciar backend si subiste backend/dist/ (toma el nuevo dist/ del disco)
sudo -u dashboardapp HOME=/home/dashboardapp pm2 restart pos-backend

# 4. Recargar Nginx (descarta index.html cacheado)
sudo nginx -t && sudo systemctl reload nginx
```

Después: hard-refresh en el browser (`Ctrl+Shift+R`).

### Procedimiento mínimo para cambios solo de frontend

1. Build local: `cd frontend && npm run build`
2. Subir solo `frontend/dist/` via WinSCP
3. SSH:
   ```bash
   sudo chown -R dashboardapp:dashboardapp /var/www/pos-dashboard/frontend/dist/
   sudo find /var/www/pos-dashboard/frontend/dist/ -type f -exec chmod 644 {} \;
   sudo systemctl reload nginx
   ```
4. No es necesario tocar pm2 para cambios solo de frontend

### Por qué `deploy.sh` no tiene este problema

`deploy.sh` hace automáticamente: build → `pm2 restart pos-backend` → `nginx reload`. Al bypassearlo con WinSCP, estos pasos deben hacerse manualmente.

---

---

## Historial técnico — sesiones recientes

### 19 Jun 2026 (sesión 2) — Implementación PRD Sales Comparison Auto-shift

**Contexto:** Implementación completa del auto-shift acordado en la sesión anterior. El backend detecta automáticamente si hoy tiene datos en `dwpreporte`; si no los tiene, usa ayer como referencia sin requerir intervención del usuario.

**Archivos modificados (backend):**
- `src/charts/sales-comparison.service.ts` — refactorizado completamente:
  - Nuevo método privado `hasDayData(empkey, ubicod, products, dayKey)`: COUNT query con `QueryBuilder`, fallback `false` en error
  - `currentHour: number | null` — null cuando día de referencia es cerrado (auto-shift o refDate en el pasado)
  - Validación de `ubicod` movida al inicio del método (antes de llamar a `hasDayData`)
  - Labels auto-shift: `['Ayer', 'Hace 2 días', 'Hace 1 semana', 'Hace 1 mes', 'Hace 1 año']`
  - `refDate` explícito: siempre respetado, sin COUNT; currentHour = hora actual si refDate=hoy, null si en el pasado

**Archivos modificados (frontend):**
- `src/api/client.ts` — `fetchSalesComparison` return type: `currentHour: number | null`; fallback `?? null` (antes `?? 0`)
- `src/components/charts/SalesComparisonChart.tsx` — 3 cambios:
  - `initialData.currentHour`: `0` → `null`
  - Badge condition: `!refDate || refDate === todayKey` → `currentHour !== null` (elimina lógica de fecha duplicada en cliente)
  - Import `dateToKey` eliminado (ya no se usa; evita error `noUnusedLocals`)

**Tests:**
- `src/charts/sales-comparison.controller.spec.ts` — 7 cambios:
  - Tests 7001 y 7002 actualizados: mock con 2 llamadas (`mockResolvedValueOnce × 2`) para que COUNT retorne datos hoy → no auto-shift
  - 5 tests nuevos en sección `AUTO-SHIFT` (empkeys 9101–9105):
    1. Hoy sin datos → labels desde ayer + currentHour null
    2. Hoy con datos → labels desde hoy + currentHour number
    3. refDate explícito hoy → 1 sola llamada a mockQuery, currentHour number
    4. refDate explícito pasado → 1 sola llamada, currentHour null
    5. Hoy y ayer sin datos → shift a ayer igual (máx 1 día), totales 0

**Resultado:** 111/111 tests ✅ · tsc backend sin errores ✅ · frontend build sin errores ✅

**Pendiente:** Deploy a QA (backend dist/ + frontend dist/)

---

### 19 Jun 2026 — Diseño Sales Comparison Auto-shift + CONTEXT.md

**Contexto:** Sesión de grilling sobre feedback del cliente. El gráfico de Comparación de Ventas muestra "Hoy" = 0 durante todo el horario laboral porque el batch de cierre carga datos recién a las 23:00. Los deltas de comparación no aportan valor en esas condiciones.

**Decisiones de diseño acordadas:**
- Backend auto-shift: cuando `refDate` no viene explícito y hoy tiene 0 datos → usar ayer como referencia
- Labels al hacer shift: "Ayer", "Hace 2 días", "Hace 1 semana", "Hace 1 mes", "Hace 1 año"
- Signal al frontend: `currentHour: number | null` — null = día cerrado completo, no mostrar badge
- Shift máximo 1 día (si ayer también es 0, mostrar igual sin buscar más atrás)
- `refDate` explícito en URL siempre se respeta sin auto-shift

**Archivos creados:**
- `CONTEXT.md` (raíz) — glosario canónico: Batch de cierre, Anchor, refDate, Auto-shift, currentHour, empkey, ubicod, topMode, DayKey
- `Recursos docs/PRD-SalesComparison-AutoShift.md` — PRD completo con user stories, decisiones de implementación y plan de tests

**Sin cambios de código en esta sesión — implementación queda para próxima sesión.**

---

### 18 Jun 2026 (noche) — Fix 500 en top-categories post-deploy

**Contexto:** Después del deploy de Top Chart Mode, `GET /api/charts/top-categories` retornaba 500. La sesión anterior había cambiado `SELECT dwpn4catcod` a `SELECT dwpn4catnom` asumiendo que esa columna existía en la vista `dwpproducto`, pero no es así.

**Causa raíz:** La vista `dwpproducto` solo tiene `dwpn4catcod` (código de categoría). El nombre completo (`dwpn4catnom`) vive en `dwpn4categoriaproducto`, que también es una vista (no tabla) — filtra `dwpfullcategoriaproducto WHERE nivel=4`.

**Archivos modificados:**
- `backend/src/charts/top-categories.service.ts` — agregado `LEFT JOIN dwpn4categoriaproducto cat ON TRIM(p.dwpn4catcod) = TRIM(cat.dwpn4catcod) AND r.dwpempkey = cat.dwpempkey` · SELECT pasa a `TRIM(cat.dwpn4catnom)` · GROUP BY `TRIM(cat.dwpn4catcod), TRIM(cat.dwpn4catnom)`

**Deploy:** solo backend (`pm2 restart pos-backend --update-env`) · verificado en QA ✅

**Tests:** 106/106 ✅ · tsc: sin errores ✅

---

### 18 Jun 2026 — Deploy Top Chart Mode en QA + fix nombres de categorías

**Contexto:** Primera sesión tras pausa. Deploy de Top Chart Mode (pendiente desde 09 Jun) y fix de feedback del cliente: las categorías mostraban códigos truncados del sistema (`PapelHigie`, `ShmpAcndr`) en vez de descripciones legibles.

**Archivos modificados (backend):**
- `src/charts/top-categories.service.ts` — SELECT cambiado de `TRIM(p.dwpn4catcod)` a `TRIM(p.dwpn4catnom)` · GROUP BY ahora incluye ambos: `TRIM(p.dwpn4catcod), TRIM(p.dwpn4catnom)` (catcod como key de agrupación estable, catnom como display)
- `package.json` — `@types/express` agregado explícitamente a devDependencies

**Bug encontrado y resuelto:**
- **Síntoma:** `pnpm test` fallaba con `Cannot find module 'express'` en 7 de 8 suites tras rebuild de node_modules
- **Causa:** `@types/express` no estaba declarado en `package.json`; era dependencia transitiva de `@nestjs/platform-express`. pnpm strict no lo hoistea cuando reconstruye desde cero
- **Solución:** `pnpm add -D @types/express` — declaración explícita requerida porque `api-key.guard.ts` importa `Request` de `express` directamente

**Deploy:**
- Frontend Top Chart Mode subido a QA por el usuario · verificado con ambos dashboards (topMode 1 y 2) ✅
- Backend con fix dwpn4catnom subido a QA y reiniciado con pm2 ✅

**Tests:** 106/106 ✅ · tsc: sin errores ✅

---

### 11 Jun 2026 — Revisión completa y actualización de CLAUDE.md

**Contexto:** Proyecto migrado a nuevo path (`C:\Claude\POS Dashboard`). Se detectó que CLAUDE.md tenía datos incorrectos y secciones desactualizadas respecto al estado real del codebase.

**Archivo modificado:**
- `CLAUDE.md` — reescrito en su totalidad con las siguientes correcciones:
  - Frontend package manager: `npm` → `pnpm` (ambos repos usan pnpm)
  - Test count: 67 → 106
  - Query params: `startDate/endDate` → `from/to` (y `refDate` donde aplica en sales-history y sales-comparison)
  - ChartsModule: "3 services" → 4 (incluye TopCategoriesService)
  - `src/app.module.ts`: agregado `ParamsModule` a la lista de imports
  - Backend: agregado `src/params/` (ParamsModule + sidecar GeneXus)
  - Backend: agregado `src/common/utils/query-builder.ts` (`QueryBuilder` class)
  - API endpoints: agregados `/api/params` y `/api/charts/top-categories` con params correctos
  - PostgreSQL rules: actualizadas para mostrar uso de `QueryBuilder` (reemplaza manejo manual de `$N`)
  - Frontend: documentados todos los hooks (`useFilters`, `useFetchChartData`, `useAppParams`, `useDismissableDropdown`)
  - Frontend: agregados `utils/dateKeys.ts`, `utils/format.ts`, `KPICards.tsx`, `ErrorBoundary.tsx`
  - Variables de entorno: agregadas `PARAMS_SIDECAR_URL` y `PARAMS_APP_ID`
  - Gotchas: `pnpm approve-builds --all` (ERR_PNPM_IGNORED_BUILDS), `deploy.sh` usa npm para frontend

**Sin cambios de código** — sesión exclusivamente de mantenimiento de documentación.

---

### 09 Jun 2026 — Fix build frontend Top Chart Mode + sidecar QA online

**Contexto:** Sidecar parameter-device subido a QA (puerto 3002). Backend `.env` ya tenía `PARAMS_SIDECAR_URL` y `PARAMS_APP_ID=ServidorPOS`. Faltaba corregir errores TS del frontend para poder buildear.

**Archivos modificados (frontend):**
- `src/api/client.ts` — `apiFetch` cambiado a `export async function` (era función privada; `useAppParams` necesita importarla)
- `src/components/charts/TopCategoriesChart.tsx` — 4 fixes:
  1. Import `TimeRange` desde `filters/TimeRangeFilter`
  2. Props `timeRange` cambiado de `{ from: string; to: string }` a `TimeRange` (from/to son `number`)
  3. `refDate` eliminado del destructuring del componente (está en Props interface para compatibilidad con Dashboard, pero no se usa internamente → `noUnusedParameters` lo rechazaba)
  4. `timeRange.from/to` convertidos con `String()` al llamar `fetchTopCategories` (API espera strings)

**Errores resueltos:**
- TS6133: `refDate` declared but never read
- TS2322: `TimeRange` (`number`) not assignable to `{ from: string; to: string }`
- TS2459: `apiFetch` not exported from `client`
- TS7006: `res` implicitly has any type (downstream del error anterior)

**Estado:** build corregido · frontend dist/ pendiente de subir a QA

---

### 08 Jun 2026 (noche) — Integración real sidecar GeneXus: DashboardTopMode confirmado

**Archivos modificados (backend):**
- `src/params/params.service.ts` — URL actualizada con `alcance=` y `parametro=DashboardTopMode` (antes `DASHBOARD_TOP_MODE`). Mapping cambiado: `ValorParametroValor: "Producto"` → `'1'`, `"Categoria"` → `'2'` (antes comparaba `'1'`/`'2'` directamente). Interface `GeneXusParamsResponse` actualizada con todos los campos reales del sidecar (`ParametroJerarquia`, `Persistencia`, `ValorInstanciado`, `ValorJerarquia`, `ValorParametroFin`, `ValorParametroIni`).
- `src/params/params.controller.spec.ts` — `gxResponse` helper actualizado: `ParametroId: 'DashboardTopMode'` + todos los campos reales. Tests usan `'Producto'`/`'Categoria'` en vez de `'1'`/`'2'`/`'3'`.
- `backend/.env` — `PARAMS_APP_ID=ServidorPOS` (confirmado con curl al sidecar local).

**Verificaciones:**
- Curl al sidecar: `GET http://localhost:3002/parameter/values?app=ServidorPOS&alcance=&parametro=DashboardTopMode&empkey=1136` → `{ ValorParametroValor: "Producto" }` ✅
- Tests: 106/106 ✅ · tsc: sin errores ✅

**Pendiente para QA:** actualizar `PARAMS_APP_ID=ServidorPOS` en `/var/www/pos-dashboard/backend/.env` y `pm2 restart pos-backend --update-env`. Verificar que el sidecar `:3002` esté corriendo en el servidor QA.

---

### 08 Jun 2026 (tarde) — PRD Top Chart Mode: slice #7 — integración GeneXus real

**Archivos modificados (backend):**
- `src/params/params.service.ts` — reemplazado stub con llamada real al sidecar (:3002). Caché in-memory 5 min por empkey. Timeout 3s con `AbortSignal.timeout`. Fallback silencioso a `'1'` en cualquier error. Si `PARAMS_APP_ID` está vacío → retorna `'1'` sin fetch.
- `src/params/params.controller.spec.ts` — ampliado de 7 a 13 tests: grupo sin sidecar (comportamiento fallback) + grupo con sidecar mockeando `global.fetch` (topMode '1', topMode '2', ECONNREFUSED, HTTP 500, array vacío, Ok=false, valor desconocido '3')
- `backend/.env` — agregadas `PARAMS_SIDECAR_URL=http://localhost:3002` y `PARAMS_APP_ID=` (vacío hasta confirmar app name)

**Tests:** 106/106 ✅ · tsc: sin errores ✅

**Resuelto:** `PARAMS_APP_ID=ServidorPOS` confirmado vía curl al sidecar (08 Jun 2026). `backend/.env` actualizado en VM dev. Pendiente: setear en QA server y `pm2 restart pos-backend --update-env`.

---

### 08 Jun 2026 — PRD Top Chart Mode: slices #1–#6

**Archivos creados (backend):**
- `src/charts/top-categories.service.ts` — nuevo service, GROUP BY TRIM(p.dwpn4catcod), fallback "Sin categoría", params: empkey/ubicod/from/to (sin products)
- `src/charts/top-categories.controller.spec.ts` — 11 tests (auth, validación, response shape, null fallback, orphan params, 500)
- `src/params/params.controller.ts` — GET /api/params?empkey=X, protegido por ApiKeyGuard
- `src/params/params.service.ts` — stub hardcodeado `{ topMode: '1' }`, listo para reemplazar con GeneXus en slice #7
- `src/params/params.module.ts` — módulo NestJS estándar
- `src/params/params.controller.spec.ts` — 7 tests (auth, validación, response stub)

**Archivos modificados (backend):**
- `src/charts/charts.controller.ts` — handler `GET /api/charts/top-categories` (empkey, ubicod?, from?, to?)
- `src/charts/charts.module.ts` — TopCategoriesService registrado como provider
- `src/app.module.ts` — ParamsModule agregado a imports
- `src/charts/*.controller.spec.ts` (3 archivos) — TopCategoriesService agregado a providers (fix por nuevo dep del controller)

**Archivos creados (frontend):**
- `src/hooks/useAppParams.ts` — fetchea /api/params una vez al montar, fallback silencioso a '1'
- `src/components/charts/TopCategoriesChart.tsx` — replica TopProductsChart sin prop products, título "Top Categorías", llama fetchTopCategories

**Archivos modificados (frontend):**
- `src/api/client.ts` — tipo TopCategoryPoint + función fetchTopCategories
- `src/components/Dashboard.tsx` — useAppParams + render condicional topMode===2→TopCategoriesChart
- `src/components/filters/ProductFilter.tsx` — prop disabled?: boolean; cuando disabled: botón disabled, label forzado, dropdown no abre

**Tests:** 99/99 ✅ (subió de 81 a 99 con 18 tests nuevos)
**tsc backend + frontend:** sin errores ✅

**Slice #7 completo.** Pendiente menor: confirmar `PARAMS_APP_ID` con admin GeneXus y setear en `.env` del servidor QA (`pm2 restart pos-backend --update-env`).

---

### 05 Jun 2026 (noche) — Deploy QA + ESLint fix useDismissableDropdown

**Archivos modificados:**
- `frontend/src/hooks/useDismissableDropdown.ts` — eliminado patrón `minWidthRef.current = minWidth` durante render (violaba nueva regla ESLint `react-hooks/refs`). Removido `useRef` por completo; `minWidth` se usa directamente en el efecto + dep array.
- `frontend/.env.production` — actualizado `VITE_API_SECRET_KEY` a clave QA para build de deploy.

**Incidentes / fixes de entorno:**
- `pnpm run build` en frontend fallaba con `ERR_PNPM_IGNORED_BUILDS: esbuild@0.27.7`. Fix: `pnpm approve-builds --all` aprueba el post-install de esbuild. Solo necesita hacerse una vez por máquina.
- `deploy.sh` usa `npm run build` para frontend — está desactualizado. El frontend usa **pnpm**. Pendiente corregirlo.
- `rsync` no disponible en Windows; `scp` disponible pero QA no es alcanzable directamente desde Windows (requiere llave privada). Deploy manual via WinSCP + SSH.

**Verificaciones:**
- Backend tests: 81/81 ✅ (subió de 67 a 81 — tests adicionales de sesiones anteriores)
- Backend tsc: sin errores ✅
- Frontend tsc: sin errores ✅
- Frontend ESLint: 0 errores tras fix ✅
- Frontend build: 811 kB JS · 43 kB CSS (warning chunk size conocido) ✅
- Backend NO modificado en esta sesión ni en ningún item del PRD Architecture Deepening (todo el trabajo del PRD fue exclusivamente frontend)

---

### 05 Jun 2026 (tarde) — R3: useFilters + Refresh Fix Unificado

**Archivos creados:**
- `frontend/src/hooks/useFilters.ts` — nuevo hook que encapsula: `ubicod`, `branchName`, `timeRange`/`timeRangeLabel`, `products`, `filtersOpen` (con localStorage), `refreshKey`, `activeFilterCount`. Expone `{ filters, refreshKey, setUbicod, setBranchName, setTimeRange, setProducts, toggleFilters, activeFilterCount, refresh }`.

**Archivos modificados:**
- `frontend/src/components/Dashboard.tsx` — reemplaza 7 `useState` + 2 `useMemo` + 2 funciones locales con `useFilters(initialUbicod, refDate)`. Dashboard ahora es componente de layout puro. `getDefaultTimeRange` movida al hook.
- `frontend/src/components/charts/TopProductsChart.tsx` — agrega prop `refreshKey: number` incluido en deps de `useFetchChartData`. Elimina dependencia de `key=` para remount.
- `frontend/src/components/charts/SalesComparisonChart.tsx` — ídem.

**Decisiones:**
- Refresh unificado: los 3 data sources usan el mismo mecanismo (deps array con `refreshKey`). Antes TopProducts y SalesComparison usaban `key={refreshKey}` → remount; ahora todos pasan `refreshKey` como dep → re-fetch sin perder estado de componente.
- `setTimeRange(range, label)` en el hook combina los dos setters previos en uno, simplificando el `onChange` de `TimeRangeFilter`.
- PRD Architecture Deepening completado: R1 ✅ R2 ✅ R3 ✅ R4 ✅ R5 ✅

**Verificación:** `tsc -b --noEmit` y ESLint sin errores.

---

## Decisiones de diseño tomadas

### `refDate` como nombre del parámetro URI
- Descartados: `dwphorakey` (nombre de columna DB — mezcla capas), `asOf` (término financiero)
- Elegido por ser semánticamente claro para cualquier dev que lea la URL

### `isToday` compara contra `new Date()` real, no contra `refDate`
- Si `refDate` es un día pasado, ese día ya terminó — no hay horas futuras — `hourCondition` no aplica
- Si se comparara contra `refDate`, un corte en el pasado activaría `hourCondition` con `currentHour=0`

### `currentHour` viene de `new Date().getHours()` — no de `refDate`
- `refDate` llega como `YYYYMMDD` sin componente horario → `getHours()` siempre retornaría `0`

### `effectiveTo` siempre aplicado — no opcional
- El `to` anterior dejaba la query sin cota superior
- Ahora siempre hay un techo: explícito → corte → hoy

### `realNow` capturado una sola vez por request
- Garantiza que `isToday` y `currentHour` hablan del mismo instante

### Validación de fecha de corte solo en frontend para el picker
- El backend no valida que `to <= refDate` — riesgo: cliente API directo puede saltear — pendiente

### Dos Nginx en lugar de uno
- Externo no tiene el `dist/` — solo puede hacer `proxy_pass`
- Alternativa descartada: `express.static()` desde Node — mezcla responsabilidades

### No compilar TypeScript en servidor de producción
- Servidor QA recibe solo `dist/` — consecuencia: `npm install` completo en el build del frontend

### `react-datepicker` sobre `input[type="date"]`
- `input[type="date"]` delega el formato al browser — Chrome muestra MM/DD/YYYY en locale US, sin forma de forzar DD/MM/YYYY
- `react-datepicker` con `dateFormat="dd/MM/yyyy"` fuerza el formato independiente del browser
- Trade-off: dependencia extra (~800KB en bundle total) pero UX correcta para LATAM

### `:focus-visible` sobre `:focus` para inputs
- `:focus` muestra ring en click de mouse (innecesario) — `:focus-visible` solo con teclado
- Recomendación de Web Interface Guidelines (Vercel)

---

## Pendientes para próximas sesiones

### 🔴 Alta prioridad — bloqueados esperando acceso

**P27 — Port forwarding TCP 5432 en NAT QA CONF para conexión SV Sandbox→DB**
- **Bloqueado** — necesita que el admin del gateway/router de QA CONF agregue la regla
- Contexto: SV Sandbox y QA CONF DB están en redes distintas. NAT compartido (5 servidores) en IP pública `38.7.200.210`. Sin port forwarding para 5432, `ECONNREFUSED` garantizado.
- **Mensaje para el admin:**
  > "Necesito port forwarding en el gateway/router: TCP puerto 5432 externo → IP interna del servidor DB puerto 5432. El origen será la IP pública del servidor SV Sandbox."
- **Opcional (recomendado):** restringir el forwarding solo a la IP pública del SV Sandbox para mayor seguridad
- **Una vez habilitado:** el `.env` ya tiene `DB_SSL=true` + `DATABASE_URL` con `?sslmode=require`, y `db.ts` ya tiene el SSL config correcto → debería conectar sin más cambios de código

**P26 — Configurar SSL nativo PostgreSQL en servidor prod DB**
- **Bloqueado** — necesita acceso SSH al servidor de base de datos (coordinado con compañero)
- Ver pasos completos en `Recursos docs/Playbook-PostgreSQL-Produccion.md`
- Resumen: habilitar `ssl = on` en `postgresql.conf`, copiar `server.crt` al servidor app, configurar `DB_SSL_CA` en `.env`, agregar línea `hostssl` en `pg_hba.conf`, regla de firewall para IP del app server
- Prerequisito para salida a producción con servidores separados

---

### 🟡 Media prioridad (pospuestos / bloqueados)

**P7 — HTTPS con Certbot**
- **Pospuesto** — riesgo alto: Certbot modifica Nginx externo (solo 1 persona tiene acceso), panel embedded de la empresa puede romperse si fuerza HTTP→HTTPS redirect.
- Prerequisitos: coordinar con compañero del Nginx externo + confirmar que el panel soporta HTTPS.

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d pos16.qa.andespos.com
```

Actualizar `FRONTEND_URL` en `.env`. Aplicar con `pm2 restart --update-env`.

**P9 — Token Tomcat** — coordinar formato con dev senior · implementar en `auth.ts`

### 🟢 Baja prioridad

**P28 — Corregir `deploy.sh`**: línea 21 usa `npm run build` para frontend — debería ser `pnpm run build`. Riesgo bajo (solo afecta si se usa `deploy.sh` desde una máquina Linux).

**P11 — Evaluar `COBERTURA_OBJETIVO`** — actualmente 80% en TopProductsChart · validar con el negocio

---

## Formato de datos — Base de Datos

```
dwphorakey bigint = YYYYMMDDHH
  Día  = dwphorakey / 100   → YYYYMMDD
  Hora = dwphorakey % 100   → HH

Columnas CHAR tienen trailing spaces → siempre TRIM()
Toda query lleva WHERE dwpempkey = $1 (multi-empresa)
Esquema: pos2407

SalesComparison — hourCondition:
  Solo se aplica cuando isToday === true.
  isToday compara anchorDayKey contra toDayKey(new Date()) REAL — no contra refDate.
  Períodos históricos (ayer, semana, mes, año) muestran el día completo.
```

---

## Conceptos clave aprendidos

### Identificador ≠ Presentación (Recharts XAxis)
`dataKey` del `XAxis` debe ser único. Lo que el usuario ve es responsabilidad de `tickFormatter` y `CustomTooltip`. Usar el string de display como identificador causó colisiones en rangos largos.

### `tick` custom vs `tickFormatter` en Recharts
Mutuamente excluyentes. Con `tick={<CustomizedAxisTick />}`, transformar con `payload.value` dentro del componente.

### Distribuciones de cola larga
`topN` fijo no escala. La pregunta correcta: *"¿cuántos productos necesito para cubrir X% del ingreso?"*

### Inyección de dependencia del tiempo
`new Date()` es un efecto secundario implícito. Práctica correcta: tratar la fecha como parámetro explícito. Aplica a tests, reportería, auditoría.

### Capas de responsabilidad en validación
`validate.ts` → formato y rango. Routes → lógica de negocio. Frontend → validación UX (no es sustituto del backend).

### Jerarquía de precedencia explícita
Patrón `a ?? b ?? c` para fallback encadenado. Cada nivel documentado con su razón.

### Reflected XSS en mensajes de error de API
Nunca reflejar el `value` del usuario en errores. Usar el nombre del parámetro hardcodeado.

### Naming collision en destructuring
`const refDate = parseRefDate(refDate, res)` falla. Solución: sufijos semánticos — `refDateRaw` y `refDateParsed`.

### Nginx elimina headers custom por defecto
Headers no estándar son descartados al hacer proxy. Siempre repassarlos con `proxy_set_header`.

### `server_name` es un filtro activo
Nginx compara el header `Host`. En arquitecturas con proxy, el `Host` que llega al interno es el del dominio externo.

### PM2 cachea variables de entorno
`pm2 restart` sin flags usa las variables del inicio original. Siempre `--update-env` después de cambiar `.env`.

### `pnpm approve-builds` requerido para esbuild en frontend
Al migrar el frontend a pnpm o en una máquina nueva, `pnpm run build` puede fallar con `ERR_PNPM_IGNORED_BUILDS: esbuild@0.27.7`. pnpm 9+ bloquea post-install scripts por seguridad. Fix: `pnpm approve-builds --all` (solo una vez por máquina). Queda registrado en `pnpm-lock.yaml`.

### `vite build` carga `.env.production` sobre `.env`
Para QA deploy: `frontend/.env.production` debe tener la clave QA. Si tiene la clave prod, el bundle quedará con la clave incorrecta → 401 en todos los requests del QA. Verificar siempre qué clave está en `.env.production` antes de buildear.

### `key=` para forzar remount vs dep en `useFetchChartData`
Usar `key={refreshKey}` en un componente que llama `useFetchChartData` causa remount completo: se pierde estado interno, animaciones, etc. Preferir pasar `refreshKey` como prop e incluirlo en el array de deps — re-fetch sin pérdida de estado. Diferencia importante cuando el componente tiene estado propio significativo (e.g. animaciones Recharts).

### `useEffect` dependency arrays — regla exhaustiva
Si un valor se usa dentro del `useEffect` (directa o indirectamente vía fetch params), debe estar en el dependency array. Omitirlo causa datos stale cuando ese valor cambia. `eslint-plugin-react-hooks` detecta esto automáticamente con la regla `exhaustive-deps`.

### PM2 startup — orden de argumentos importa
`pm2 startup systemd -u --hp /home/user` parsea `--hp` como valor de `-u` → genera servicio con `User=--hp`. El username siempre debe ir inmediatamente después de `-u`: `pm2 startup systemd -u dashboardapp --hp /home/dashboardapp`.

### `pm2-<user>.service` estado `inactive (dead)` es normal
El servicio systemd de PM2 solo actúa en boot ejecutando `pm2 resurrect`. Si PM2 ya está corriendo (porque lo levantaste manualmente), el servicio aparece `inactive` — esto no indica error.

### `touch-action: manipulation` en inputs de fecha
Previene el delay de 300ms por double-tap zoom en móviles. Recomendación de Web Interface Guidelines para cualquier elemento interactivo que no necesite zoom.

### Winston vs `console.log` en producción
`console.log` no tiene rotación, nivel, formato ni persistencia. Winston con `DailyRotateFile` da logs JSON estructurados con timestamp, rotación por fecha/tamaño, retención configurable, y metadata (empkey, error). En dev mantiene console con colores; en prod solo archivos.

### Nunca loguear connection strings completos
`console.log(DATABASE_URL)` expone usuario, contraseña, host y DB en los logs. Si los logs se comparten o se suben a un sistema de monitoreo, las credenciales quedan expuestas. Loguear solo el hecho de que la variable falta, no su contenido.

### `VITE_*` se bake en el bundle en build time — no en runtime
Las variables `VITE_API_SECRET_KEY` se resuelven durante `npm run build`, no al cargar la app en el browser. Si el backend de producción tiene una key distinta a la que había en `frontend/.env` al compilar, todos los requests llegarán con credencial incorrecta → 401. Verificar siempre que ambas keys coincidan **antes** del build del frontend.

### `?.` no protege cuando el objeto raíz es `undefined`
`data[0]?.total ?? 0` — si `data` es `undefined` (no `[]`), el acceso `data[0]` ya lanza `TypeError` antes de que `?.` pueda actuar. El optional chaining solo protege la cadena **después** del punto. Siempre usar fallbacks en fetch (`json.data ?? []`) para garantizar que el estado inicial de los componentes sea el tipo correcto, no `undefined`.

---

## Lecciones aprendidas — NestJS + TypeORM + Tests

### `ChartCacheInterceptor` debe ser provider real en tests (no mock)
Si se mockea el interceptor, los tests no ejercitan el path real. Incluirlo como provider en `TestingModule`. Usar `empkey` únicos por test para evitar cache hits entre tests.

### Patrón tests de controllers NestJS con Supertest
Crear `TestingModule` con el módulo bajo prueba + providers reales. Usar `app.init()` en `beforeAll` y `app.close()` en `afterAll`. El `ValidationPipe` debe registrarse igual que en `main.ts`.

### PostgreSQL rechaza parámetros no referenciados en el SQL
Si un `$N` está en el array de `params` pero no aparece en la query, PostgreSQL retorna "no se pudo determinar el tipo del parámetro $N". Solución: solo pushear params que se van a usar. En salesComparison, `currentHour` solo se pushea si `needsHourFilter === true`.

### node-postgres: preferir `IN ($1, $2)` sobre `ANY($1::type[])`
La FAQ de node-postgres muestra dos formas de manejar arrays. `= ANY($1)` con array anidado requiere que pg serialice el array como string literal, y el cast explícito `::bigint[]` puede fallar. `IN ($1, $2, $3)` con params planos es más seguro y explícito. Verificado contra context7.

### `ValidationPipe` de NestJS requiere `class-validator` + `class-transformer` como deps de producción
Si se usa `app.useGlobalPipes(new ValidationPipe(...))` en `main.ts`, ambos paquetes deben estar en `dependencies` (no `devDependencies`). Sin ellos, el app arranca pero loguea error y la validación no funciona.

### `pnpm install --prod` requiere `package.json` + `pnpm-lock.yaml` en el servidor
Transferir solo `dist/` no es suficiente. El servidor necesita `package.json` y `pnpm-lock.yaml` para que `pnpm install` sepa qué instalar. Agregar ambos al procedimiento de WinSCP.

---

## Lecciones aprendidas — Redes / Infraestructura

### `ECONNREFUSED` con PostgreSQL escuchando ≠ problema de código
Si `ss -tlnp | grep 5432` muestra `*:5432` y ufw/iptables están inactivos pero igual hay `ECONNREFUSED`, el problema está en la capa de red antes del servidor: NAT sin port forwarding. `listen_addresses = '*'` y `hba.conf` son configuración de PostgreSQL — solo aplican cuando el paquete TCP llega al servidor. Si hay un NAT/router en el medio sin regla para el puerto, el paquete nunca llega.

### NAT con múltiples servidores requiere port forwarding explícito por puerto
Si N servidores comparten una IP pública, el router no sabe a cuál enviar cada conexión entrante. Debe existir una regla por puerto: `TCP <puerto> externo → IP_interna_servidor:puerto`. HTTP (80/443) suele estar configurado; puertos de bases de datos (5432, 3306) raramente lo están por defecto.

### `ping dominio` resuelve la IP del NAT, no necesariamente la del servidor destino
El dominio apunta al NAT. Si hay múltiples servidores detrás, el ping confirma que el dominio resuelve correctamente pero no dice nada sobre conectividad al servidor específico. La IP que aparece en DevTools "Remote Address" del browser es la del servidor que respondió HTTP — puede ser diferente a la del servidor DB.

### Firewall del OS vs NAT gateway son capas independientes
`ufw inactive` + `iptables sin reglas` solo descarta el firewall del OS del servidor destino. No descarta firewalls en el router/gateway, en cloud security groups, o en reglas de red del proveedor. Siempre explorar todas las capas cuando hay `ECONNREFUSED`.

---

## Lecciones aprendidas — Nginx

| Concepto | Regla |
|----------|-------|
| `alias` vs `proxy_pass` | `alias` = archivos locales. `proxy_pass` = otro servidor |
| `server_name` | Filtro activo — debe incluir el dominio externo. En servidores nuevos con dominio distinto a la IP, siempre agregar el FQDN al `server_name` o matchea `default_server`. |
| `sites-available` vs `sites-enabled` | available = archivo real (NUNCA borrar). enabled = symlink |
| Headers custom en proxy | Nginx elimina headers no estándar — siempre repassar con `proxy_set_header` |
| `default_server` | Solo un bloque puede tenerlo por puerto |
| PM2 y variables de entorno | `pm2 restart --update-env` para recargar variables desde .env |
| Frontend build en servidor | Construir local y subir solo `dist/` — nunca buildear backend/frontend en el servidor |
| Order de locations | Location de API debe ir antes que el del frontend |

---

## Contexto crítico que NO está en el código

- `refDate` llega como `YYYYMMDD` sin componente horario — `getHours()` siempre retorna `0`
- `isToday` compara contra `new Date()` real, **no contra `refDate`** — esto es intencional
- `effectiveTo` en `salesHistory.ts` siempre tiene valor — no es opcional
- Sin `refDate` en la URI, la app se comporta exactamente igual que antes — parámetro aditivo no destructivo
- **Dashboard owns `fetchSalesHistory`** — KPICards y SalesHistoryChart reciben data/loading/error como props, NO hacen fetch propio
- **salesComparison usa 1 query consolidada** con `SUM(CASE WHEN ...)` + `WHERE IN` — NO `Promise.all` con 5 queries
- **`needsHourFilter`** controla si `currentHour` se pushea a params — NUNCA pushear params que no se referencian en el SQL
- **NO usar `ANY($N::bigint[])` con TypeORM raw** — usar `IN ($a, $b, $c)` con params individuales
- **`ChartCacheInterceptor`** en `backend/src/common/` — TTL 60s, solo 2xx, key = URL completa
- **Rate limiter** ThrottlerModule global — 300 req/15min
- **Tests:** `cd backend && pnpm test` — 67 tests, Jest + Supertest
- **`ApiKeyGuard`** en `src/common/` valida `x-api-key` header contra `API_SECRET_KEY`
- **AbortController en los 3 fetches de charts** — `client.ts` acepta `AbortSignal`, cada `useEffect` crea controller + cleanup `abort()`. `isAbortError()` en `client.ts` distingue cancelaciones de errores reales. Requests `(cancelled)` en DevTools = comportamiento esperado.
- **`useReducer` en SalesComparisonChart y TopProductsChart** — ya NO usan `useState` individual para loading/data/error. Usan `useFetchChartData` hook con `useReducer` interno (acciones FETCH_START/SUCCESS/ERROR). Al agregar fetches nuevos, seguir este patrón.
- **`useFilters(initialUbicod, refDate)`** en `frontend/src/hooks/useFilters.ts` — encapsula TODO el estado de filtros. Dashboard.tsx destructura `{ filters, refreshKey, setUbicod, setBranchName, setTimeRange, setProducts, toggleFilters, activeFilterCount, refresh }`. El `setTimeRange(range, label)` del hook reemplaza dos setters separados.
- **`refreshKey` en TopProductsChart y SalesComparisonChart** — ambos aceptan `refreshKey: number` como prop e incluyen en deps de `useFetchChartData`. NO usar `key={refreshKey}` para estos componentes.
- **`TooltipProps` de Recharts** — importar con `import type { TooltipProps } from 'recharts'`. `TooltipProps<number, number>` para SalesHistoryChart (label = dayKey numérico), `TooltipProps<number, string>` para SalesComparisonChart (label = texto). No usar `any`.
- **PM2 `--cwd` es obligatorio en pos-prod-sim** — `pm2 start dist/main.js --name pos-backend --cwd /var/www/pos-dashboard/backend`. Sin `--cwd`, PM2 usa el home del usuario como working directory y dotenv no encuentra el `.env` → crash con "DATABASE_URL no configurada"
- **PM2 startup en pos-prod-sim**: usar `pm2 startup systemd -u dashboardapp --hp /home/dashboardapp` directamente como root (sin `sudo env` wrapper — sudo no está instalado en esta VM)
- **pos-prod-sim reboot**: el backend sobrevive reboot de VM siempre que PuTTY en Windows esté activo. Si PuTTY se cierra, PM2 arranca pos-backend pero falla al conectar a la DB silenciosamente.
- **Arquitectura prod confirmada (21 Abr)**: servidor app y servidor DB serán separados, ambos con IPs públicas. Tráfico Node.js → PostgreSQL cruza internet → SSL obligatorio con verificación de certificado.
- **`DB_SSL=true` nueva variable de entorno**: activa SSL en `db.ts` sin importar `NODE_ENV`. Permite conectar a DBs SSL desde entornos QA/sandbox sin cambiar NODE_ENV a production. Agregar al `.env` junto con `?sslmode=require` en la `DATABASE_URL`. Sin cert, usa `rejectUnauthorized: false` (válido en red privada/QA).
- **`DB_SSL_CA` nueva variable de entorno**: path al `server.crt` del servidor Postgres. Si está configurada, `db.ts` usa `rejectUnauthorized: true` + el cert. Si no está, hace fallback a `rejectUnauthorized: false` (solo para red privada). Para producción con IPs públicas SIEMPRE configurar esta variable.
- **Graceful shutdown en `index.ts`**: `SIGTERM`/`SIGINT` llaman `pool.end()` antes de salir. Crítico para que `pm2 restart` no corte queries en vuelo. Los handlers están dentro del bloque `NODE_ENV !== 'test'`.
- **`/api/health` endpoint**: devuelve `{ status, db: { total, idle, waiting }, uptime }`. Está protegido por `authMiddleware`. Usar para diagnosticar si el pool está saturado (`waiting > 0` sostenido = pool undersized).
- **`min: 2` en el pool**: mantiene 2 conexiones warm. Evita cold-start latency en el primer request post-deploy.
- **SSL nativo de Postgres en Debian**: el paquete `postgresql` genera `server.crt` y `server.key` en `/etc/postgresql/XX/main/` solo si `ssl = on` en `postgresql.conf`. Si el cert no existe, habilitar SSL primero (`ssl = on` + `pg_ctlcluster XX main reload`).
- **`hostssl` en `pg_hba.conf`**: a diferencia de `host` (acepta con o sin SSL), `hostssl` rechaza conexiones sin SSL a nivel Postgres. Usar para el usuario de la app del dashboard. No tocar las líneas existentes de los usuarios de Tomcat.
- **Dark mode contraste validado (14 Abr)**: `--text-very-muted` es ahora `#6e8fa8` (L≈0.258, ratio ~5:1 bg-card). `badge-neutral` usa `#8399b0`. Tooltips y lista de comparación usan `--text-mid`. Leyenda "Otros" en TopProducts: fill del pie sigue en `#4b5563`, texto usa `--text-muted`/`--text-mid`.
- **Servidor QA limpio (14 Abr)**: frontend en QA solo tiene `dist/`. Backend solo tiene `dist/`, `node_modules/`, `logs/`, `package.json`, `pnpm-lock.yaml`, `.env`. No hay `src/` en ninguno.
- **Playbook de producción**: `Recursos docs/Playbook-Produccion.md`. Servidor prod: Debian 12, Tomcat en 8080 (no tocar), PostgreSQL local, Nginx en 80, Nginx externo delante. `API_SECRET_KEY` prod: `0c8ed4477e54bac978f5344182486283401ac21c44c6d40ee92d4ded4442bfeb`. Pendiente completar: dominio prod, IP prod, credenciales DB, coordinar Nginx externo con compañero.
- **Para el deploy a prod**: instalar Node 22 + PM2 + Nginx + crear `dashboardapp`. El `--cwd /var/www/pos-dashboard/backend` sigue siendo obligatorio en el `pm2 start`. El compañero del Nginx externo debe agregar `proxy_set_header x-api-key $http_x_api_key` — sin esto, 401 en todos los endpoints desde el dominio público.
- **Servidores sandbox (21 Abr)**: pos16.sb.andespos.com (al menos 2 servidores app). Conectan a DB QA. PM2 como `dashboardapp`. Nginx config usaba `server_name 10.50.10.23 localhost` — no incluía el FQDN público → requests al dominio matcheaban `default_server` → 404. Fix: agregar el dominio a `server_name`. Verificar siempre `server_name` al configurar un servidor nuevo con dominio externo.
- **`frontend/.env.production` tiene clave QA** desde sesión 05 Jun noche — si se va a deployer a prod, restaurar a `0c8ed4477e54bac978f5344182486283401ac21c44c6d40ee92d4ded4442bfeb` antes del build.
- **Tests backend: 99** (no 67/81) — 18 tests nuevos en sesión 08 Jun (top-categories: 11, params: 7).
- **Al agregar un provider nuevo al ChartsController, actualizarlo en los 3 spec files existentes** — `top-products.controller.spec.ts`, `sales-history.controller.spec.ts`, `sales-comparison.controller.spec.ts` registran `ChartsController` directamente y deben listar TODOS sus providers.
- **ParamsModule NO tiene dependencia de DatabaseModule ni de `@nestjs/axios`** — usa `fetch` nativo de Node 18+. No se agregó ninguna nueva dependencia para slice #7.
- **`DashboardTopMode` en GeneXus**: `ValorParametroValor: "Producto"` → topMode `'1'` (top productos) · `"Categoria"` → topMode `'2'` (top categorías). URL sidecar: `?app=ServidorPOS&alcance=&parametro=DashboardTopMode&empkey={N}`. `PARAMS_APP_ID=ServidorPOS` confirmado 08 Jun 2026.
- **`useAppParams` fetchea una sola vez al montar** — no re-fetcha en cambios de filtros. El topMode es estable durante la sesión (mismo empkey). Si la empresa cambia `DASHBOARD_TOP_MODE`, el usuario verá el cambio en la próxima carga del dashboard.
- **TopCategoriesChart no recibe `products`** — el backend `top-categories` no acepta el parámetro `products` por diseño. El ProductFilter en Dashboard se deshabilita visualmente cuando topMode==='2'.
- **`deploy.sh` usa `npm run build` para frontend — INCORRECTO** — usar `pnpm run build` directamente si se ejecuta desde Windows/VM con pnpm instalado.
- **`ValorParametroValor` en GeneXus es texto semántico, no numérico** — el sidecar devuelve `"Producto"` y `"Categoria"`, no `'1'`/`'2'`. El mapeo a los valores internos del frontend (`'1'`/`'2'`) ocurre en `extractTopMode()`. No asumir que los parámetros GeneXus usan valores numéricos.
- **`PARAMS_APP_ID` = nombre de la Aplicacion_Idl en GeneXus** — para este proyecto es `ServidorPOS`. Verificar con curl antes de setear en producción: `curl "http://localhost:3002/parameter/values?app=ServidorPOS&alcance=&parametro=DashboardTopMode&empkey=1136"`.
- **El campo `parametro` en la URL del sidecar es case-sensitive** — `DashboardTopMode` no es lo mismo que `DASHBOARD_TOP_MODE`. Verificar siempre contra la definición real en GeneXus.
- **`/api/health` desde browser → 401 es NORMAL**: el browser no envía `x-api-key` automáticamente. Solo el frontend (via `api/client.ts`) lo envía. Para probar el endpoint con curl, pasar `-H "x-api-key: <KEY>"` explícitamente.

---

## Instrucciones para la próxima sesión de Claude

### Archivos a pedir ANTES de diagnosticar

| Tarea / Síntoma | Archivos a pedir |
|----------------|-----------------|
| Datepicker styling / bugs | `frontend/src/components/filters/TimeRangeFilter.tsx` + `frontend/src/index.css` |
| Badge hora | `frontend/src/components/charts/SalesComparisonChart.tsx` |
| Validación backend | `backend/src/common/` (guards, DTOs) |
| Error en gráficos | `frontend/src/components/charts/[Chart].tsx` |
| 401 / autenticación | `backend/src/common/api-key.guard.ts` + `frontend/src/api/client.ts` |
| Logging / errores backend | `backend/src/main.ts` (winston config) + logs en `/var/www/pos-dashboard/backend/logs/` |
| Crash frontend / pantalla blanca | `frontend/src/components/ErrorBoundary.tsx` + `frontend/src/App.tsx` |
| Nginx no sirve | `cat /etc/nginx/sites-enabled/pos-dashboard` |
| PM2 no levanta | `tail /var/www/pos-dashboard/backend/logs/error-*.log` o `pm2 logs pos-backend` |
| Tests / nuevo endpoint | `backend/src/[módulo]/[módulo].controller.spec.ts` + `[módulo].service.ts` |
| Cache backend | `backend/src/common/chart-cache.interceptor.ts` + `backend/src/charts/charts.module.ts` |

### Lo que NO debe asumir Claude

- No asumir que el `dist/` del servidor QA está sincronizado con la VM
- No asumir que PM2 tomó nuevas variables sin `--update-env`
- No asumir que Nginx recargó config sin `sudo systemctl reload nginx`
- No diagnosticar sin ver el código real — siempre pedirlo primero

### Metodología del equipo
- Developer aprende haciendo → concepto + pista antes de solución completa
- Código completo solo si se pide explícitamente o tras varios intentos fallidos
- Stack: React + Vite + TypeScript + Recharts + Tailwind · NestJS 11 + TypeORM + TypeScript + PostgreSQL · Nginx + PM2 + Debian 12 · pnpm (backend)
- Formato fechas en display: siempre `DD/MM/AA` o `DD/MM/AAAA`
