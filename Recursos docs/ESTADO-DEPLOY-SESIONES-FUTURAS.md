# POS Dashboard — Estado del Deploy y Contexto para Sesiones Futuras
> Última actualización: 19 Marzo 2026
> Integra sesiones: 16 Mar (bugs Recharts) · 18 Mar (deploy QA) · 18 Mar (feature refDate) · 18 Mar (pendientes críticos P1–P3) · 19 Mar (refactor /simplify — dedup, performance, shared utils)

---

## Estado actual del proyecto

| Componente | Estado | Servidor |
|-----------|--------|----------|
| Backend Express :3001 | ✅ Online (PM2) | 10.50.10.5 |
| Frontend React dist/ | ✅ Servido por Nginx interno | 10.50.10.5 |
| Nginx interno | ✅ Configurado y activo | 10.50.10.5 |
| Nginx externo | ✅ Funcionando con proxy correcto | pos16.qa.andespos.com |
| DB PostgreSQL | ✅ Conectada (DB: pos) | 10.50.10.5 localhost |
| CORS | ✅ FRONTEND_URL=https://pos16.qa.andespos.com | backend .env |
| API Key / 401 | ✅ Resuelto — Nginx externo pasa x-api-key | — |
| App en QA | ✅ https://pos16.qa.andespos.com/POSdashboard2603/ | — |
| SalesHistoryChart — tooltip | ✅ Corregido (dataKey="day", identificador único) | — |
| SalesHistoryChart — eje X | ✅ Legible con tick rotado -30° | — |
| TopProductsChart — "Otros" | ✅ Algoritmo cobertura acumulada (reemplaza topN fijo) | — |
| `refDate` — backend | ✅ parseRefDate, effectiveTo, isToday vs realNow | — |
| `refDate` — frontend | ✅ App, Dashboard, client.ts, TimeRangeFilter, KPICards, SalesComparisonChart | — |
| `SalesHistoryChart` — recibe refDate | ✅ Verificado — Props, fetch, useEffect deps | — |
| `TopProductsChart` — recibe refDate | ✅ Verificado — Props, fetch, useEffect deps | — |
| `SalesComparisonChart` — badge hora | ✅ Oculto cuando refDate es pasado + refDate en useEffect deps | — |
| `TimeRangeFilter` — formato DD/MM/YYYY | ✅ react-datepicker + locale es + ocean theme CSS | — |
| `dateUtils.ts` — módulo compartido | ✅ `backend/src/utils/dateUtils.ts` — toDayKey exportada | — |
| Validación backend from > to | ✅ Ya existía en salesHistory.ts líneas 53-57 | — |
| Validación frontend — refDate inválido | ✅ isValidRefDate gate en App.tsx + keyToDate defensiva + ErrorBoundary | — |
| Shared utils frontend | ✅ `utils/format.ts` (formatCLP, formatCLPFull) + `utils/dateKeys.ts` (dateToKey, keyToDate, parseRefDateString, formatDayKey) | — |
| Duplicate fetchSalesHistory | ✅ Eliminado — Dashboard owns fetch, KPICards y SalesHistoryChart reciben data via props | — |
| Clock 60s re-render | ✅ Extraído a `<Clock />` component — solo Clock re-renderiza, no Dashboard entero | — |
| ThemeContext value stability | ✅ Provider value en useMemo/useCallback — evita re-renders innecesarios en consumers | — |
| TopProductsChart "Otros" memoization | ✅ Grouping logic envuelto en useMemo([raw]) | — |
| App.css (dead code) | ✅ Eliminado — boilerplate Vite no usado | — |
| pm2 startup systemd | ✅ pm2-dashboardapp.service enabled + dump.pm2 saved | 10.50.10.5 |
| HTTPS / Certbot | ⏳ Pospuesto — riesgo en Nginx externo + panel embedded | — |
| Token Tomcat | ⏳ Pendiente definición senior | — |
| Winston logging | ✅ logger.ts + daily rotate + 13 console calls migrados | — |
| Leak DATABASE_URL en logs | ✅ Eliminado — db.ts ya no loguea credenciales | — |
| Tests Vitest + Supertest | ⏳ — | — |

---

## Servidores involucrados

| Servidor | IP / Dominio | Rol | Acceso |
|---------|-------------|-----|--------|
| VM desarrollo | 192.168.56.99 | Origen del build, testing | SSH + WinSCP |
| Servidor QA | 10.50.10.5 (qa-pos16) | App + DB | SSH + WinSCP |
| Proxy externo | pos16.qa.andespos.com | Nginx reverse proxy + HTTPS | Solo 1 compañero |

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
```

> ⚠️ `API_SECRET_KEY` debe ser idéntica a `VITE_API_SECRET_KEY` en el frontend `.env`.
> Generar con: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

---

## Estructura en servidor QA (10.50.10.5)

```
/var/www/pos-dashboard/
├── backend/
│   ├── dist/          ← compilado TypeScript (transferido desde VM)
│   ├── node_modules/  ← generado con npm install --omit=dev
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

# ── Rebuild frontend en el servidor ──────────────────────────
# ⚠️ npm install completo (con devDeps) — vite y tsc son devDependencies
cd /var/www/pos-dashboard/frontend
npm install
npm run build

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

## 1. Qué se implementó — historial técnico por sesión

### Sesión 16 Mar — Bugs Recharts

#### `frontend/src/components/charts/SalesHistoryChart.tsx`
- `dayKeyToLabel(key)` corregida para incluir año de 2 dígitos → `"DD/MM/AA"`
- `XAxis` cambiado a `dataKey="day"` (número YYYYMMDD, único) en lugar de `"label"` (string colisionable)
- `tickFormatter` y `CustomizedAxisTick` usan `dayKeyToLabel(payload.value)` para display
- `CustomTooltip` aplica `dayKeyToLabel(label)` — recibe el número crudo, no el string
- `chartData` simplificado: ya no agrega campo `label` redundante
- `CustomizedAxisTick` definido fuera del componente, rota labels -30°, `margin bottom: 20`

#### `frontend/src/components/charts/TopProductsChart.tsx`
- Eliminadas `getTopN()` y `getUmbralPorcentaje()` — no escalan con distribuciones de cola larga
- Nuevas constantes: `COBERTURA_OBJETIVO = 0.80`, `MAX_SLICES = 8`
- Algoritmo de cobertura acumulada: loop sobre `raw` ordenado desc, acumula hasta 80% del total o 8 slices
- Resto → `"Otros (N productos)"` con `esOtros: true`
- `Set<number>` para lookup O(1) de productos ya incluidos

---

### Sesión 18 Mar — Deploy QA

#### `frontend/vite.config.ts`
- Agregado `base: '/POSdashboard2603/'` — sin esto los assets se pedían desde `/` y daban 404 en subpath

#### `/etc/nginx/sites-available/pos-dashboard` (10.50.10.5)
- Instalado y configurado Nginx desde cero en servidor QA
- 4 locations: API subpath, frontend subpath, API legacy, root legacy
- `server_name` incluye dominio externo + IP + localhost

#### Config Nginx externo (pos16.qa.andespos.com)
- Dos locations nuevos en server block existente
- `proxy_set_header x-api-key $http_x_api_key` — línea crítica que resolvió el 401

#### `backend/.env` (servidor QA)
- `FRONTEND_URL` corregido a `https://pos16.qa.andespos.com`
- `rejectUnauthorized: false` en `db.ts` para certificado autofirmado de PostgreSQL QA

#### `/var/www/pos-dashboard/deploy-servidor-nuevo.sh`
- Script de deploy para servidor sin TypeScript — solo recibe `dist/` desde VM
- Pasos: verifica dist/ y .env → permisos → `npm install --omit=dev` → PM2 start/restart → health check

---

### Sesión 18 Mar — Feature `refDate`

#### `backend/src/middleware/validate.ts`
- Nueva función `parseRefDate(value, res): Date | null | 'invalid'`
- Parsea query param `refDate` (string YYYYMMDD) → objeto `Date`
- Retorna `null` si no viene, `'invalid'` + HTTP 400 si malformado
- Mensaje de error hardcodeado — nunca refleja el `value` del usuario (prevención Reflected XSS)

#### `backend/src/routes/salesComparison.ts`
- Extrae `refDateRaw` del query (evita naming collision)
- `refDateParsed`: resultado de `parseRefDate` con guard `if === 'invalid' return`
- `now = refDateParsed ?? new Date()`: ancla los 5 períodos al corte
- `realNow = new Date()`: capturado una sola vez por request
- `isToday = (anchorDayKey) => anchorDayKey === toDayKey(realNow)`: compara contra día REAL del servidor, no contra `refDate`
- `currentHour = realNow.getHours()`: hora real, no de `refDate` (que no tiene componente horario)

#### `backend/src/routes/salesHistory.ts`
- `effectiveTo`: jerarquía de 3 niveles:
  1. `toDate` explícito en URI (máxima prioridad)
  2. `toDayKey(refDateParsed)` si no vino `to`
  3. `toDayKey(new Date())` — comportamiento original
- `effectiveTo` **siempre se aplica** — ya no es opcional
- `toDayKey` agregada localmente (pendiente mover a módulo compartido)

#### `frontend/src/App.tsx`
- `getUrlParams()` extrae también `refDate: params.get('refDate')`
- `<Dashboard>` recibe `refDate={refDate}` como prop nueva

#### `frontend/src/components/Dashboard.tsx`
- `interface Props` agrega `refDate: string | null`
- `getDefaultTimeRange(refDate)`: ancla el `to` en `refDate` si existe, sino `new Date()`
- `useState<TimeRange>(() => getDefaultTimeRange(refDate))` — inicialización lazy
- `refDate` propagado como prop a todos los charts y KPICards

#### `frontend/src/api/client.ts`
- `fetchSalesHistory`, `fetchTopProducts`, `fetchSalesComparison`: agregan `refDate?: string | null`
- `buildParams` ya maneja `null` con `if (v == null) continue` — sin cambios adicionales

#### `frontend/src/components/filters/TimeRangeFilter.tsx`
- `getPreset(days, refDate)` y `getThisYear(refDate)`: anclan `to` en `refDate` si existe
- `PRESETS` → `getPresets(refDate)`: función dinámica en lugar de array estático
- `interface Props` agrega `refDate: string | null`
- Atributo `max` en input `to`: bloquea fechas posteriores al corte
- Validación en `onChange`: ignora cambio si `newTo > maxTo`

#### `frontend/src/components/KPICards.tsx` y `SalesComparisonChart.tsx`
- `interface Props` agrega `refDate: string | null`
- `refDate` pasado al fetch correspondiente y al array de dependencias del `useEffect`

---

### Sesión 18 Mar — Pendientes críticos (P1, P2, P3)

#### P3 → P2 doc: `refDate` en `useEffect` dependency arrays (fix)
- **Problema:** `SalesHistoryChart` y `TopProductsChart` recibían `refDate` en Props y lo pasaban al fetch, pero no lo incluían en el array de dependencias del `useEffect`
- **Archivos:** `SalesHistoryChart.tsx` (línea 68), `TopProductsChart.tsx` (línea 184)
- **Fix:** Agregar `refDate` al array: `[empkey, ubicod, timeRange.from, timeRange.to, products, refDate]`
- **Verificación:** `tsc --noEmit` limpio

#### P3 → P2 doc: PM2 startup systemd para `dashboardapp`
- **Problema 1:** Primer intento con `pm2 startup` generó servicio roto (`pm2---hp.service`) porque `-u` y `--hp` se parsearon sin username en el medio → `User=--hp`, `PM2_HOME=/root/.pm2`
- **Fix:** Limpiar servicio roto + recrear con comando correcto:
  ```bash
  sudo systemctl disable pm2---hp && sudo rm /etc/systemd/system/pm2---hp.service && sudo systemctl daemon-reload
  sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u dashboardapp --hp /home/dashboardapp
  sudo -u dashboardapp HOME=/home/dashboardapp pm2 save
  ```
- **Resultado:** `pm2-dashboardapp.service` enabled + `dump.pm2` guardado en `/home/dashboardapp/.pm2/`
- **Nota:** `Active: inactive (dead)` es normal — el servicio solo actúa en boot ejecutando `pm2 resurrect`

#### P1 → P1 doc: `react-datepicker` con locale español y ocean theme

##### `frontend/src/components/filters/TimeRangeFilter.tsx`
- Eliminadas `keyToInputValue()` y `inputValueToKey()` — solo servían para `input[type="date"]`
- Nueva función `keyToDate(key: number): Date` — convierte YYYYMMDD a objeto Date para el picker
- `dateToKey()` reutilizada — convierte Date de vuelta a YYYYMMDD en `onChange`
- `maxToDate` computado: `refDate ? keyToDate(parseInt(refDate)) : new Date()`
- Dos `<input type="date">` reemplazados por dos `<DatePicker>` con:
  - `dateFormat="dd/MM/yyyy"` — formato forzado independiente del locale del browser
  - `locale="es"` — meses y días en español (registrado con `registerLocale`)
  - `maxDate={maxToDate}` — respeta `refDate` como tope
  - `aria-label` ("Fecha desde", "Fecha hasta") — accesibilidad
  - `name` ("date-from", "date-to") — semántica de formulario
  - `autoComplete="off"` — evita sugerencias de password manager
  - `placeholderText="dd/mm/aaaa"` — UX cuando input vacío
  - `showPopperArrow={false}` — prop nativo, sin hack CSS
  - `popperPlacement="bottom-start"` — alineado al filtro
- Presets, Props interface, `getPreset`, `getThisYear`, `getPresets` — sin cambios
- Nuevas dependencias: `react-datepicker`, `date-fns`

##### `frontend/src/index.css`
- ~75 líneas de CSS para react-datepicker con ocean theme:
  - `.datepicker-input` — usa `--bg-input`, `--border-input`, `--text-mid`, `touch-action: manipulation`
  - `.datepicker-input:focus-visible` — ring azul solo con teclado (no al click)
  - `.react-datepicker` — `--bg-surface`, `--border-card`, border-radius 12px, glow sutil `rgba(59,130,246,0.08)`
  - `.react-datepicker::before` — gradient line top igual que `.card` y `.kpi-card`
  - `.react-datepicker__day--selected` — `#3b82f6` (mismo accent que `.filter-pill.active`)
  - `.react-datepicker__day--today` — `#60a5fa` (accent)
  - `.react-datepicker__current-month` — `text-transform: capitalize` (date-fns es retorna lowercase)
  - `@media (prefers-reduced-motion)` — `transition: none` en días del calendario
- Plan revisado contra: Web Interface Guidelines (Vercel), context7 (react-datepicker docs), frontend-design skill

---

### Sesión 19 Mar — Refactor /simplify (dedup, performance, shared utils)

#### Shared utilities creadas

##### `frontend/src/utils/format.ts`
- `formatCLP(v)`: formateador corto con tiers B/M/K — versión unificada (incluye billones de KPICards)
- `formatCLPFull(v)`: `Intl.NumberFormat` hoisted a module scope — evita reconstruir el formatter en cada call
- Reemplaza 7 definiciones duplicadas en: SalesHistoryChart, SalesComparisonChart, TopProductsChart, KPICards

##### `frontend/src/utils/dateKeys.ts`
- `dateToKey(d)`: Date → YYYYMMDD integer (antes duplicada en TimeRangeFilter + Dashboard inline `fmt`)
- `keyToDate(key)`: YYYYMMDD → Date con fallback defensivo (antes local en TimeRangeFilter)
- `parseRefDateString(s)`: valida + parsea string YYYYMMDD → Date | null (reemplaza `isValidRefDate` en App.tsx y parsing inline en Dashboard, TimeRangeFilter)
- `formatDayKey(key, format)`: formatea YYYYMMDD para display en 3 formatos ('short' DD/MM, 'medium' DD/MM/YY, 'long' DD/MM/YYYY) — reemplaza `dayKeyToLabel`, `dayLabel`, `fmtDate` en 3 archivos

#### Duplicate `fetchSalesHistory` eliminado (impacto alto)
- **Problema:** KPICards y SalesHistoryChart llamaban ambos `fetchSalesHistory` con params idénticos — doble request en cada cambio de filtro
- **Fix:** Dashboard.tsx ahora owns el fetch con `useReducer` (evita lint warning `set-state-in-effect`)
- KPICards recibe `{ data, loading }` como props — ya no fetch interno, KPIs computados con `useMemo([data])`
- SalesHistoryChart recibe `{ data, loading, error }` como props — ya no fetch interno
- **Impacto:** -50% requests a `/api/charts/sales-history`, más headroom para rate limiter (100 req/15min)

#### Clock extraído (impacto medio)
- **Problema:** `setNow(new Date())` cada 60s re-renderizaba todo Dashboard (header, filtros, charts)
- **Fix:** Nuevo componente `<Clock />` dentro de Dashboard.tsx — owns su propio state + interval
- Solo el display de hora/fecha se actualiza cada minuto, no el árbol completo

#### ThemeContext optimizado
- Provider value envuelto en `useMemo([theme, toggle])` + `toggle` en `useCallback`
- Evita que todos los `useTheme()` consumers re-rendericen cuando ThemeProvider re-renderiza

#### TopProductsChart — memoization + cleanup
- Grouping "Otros" (reduce, loop, Set, filter) envuelto en `useMemo([raw])` — no se recalcula en re-renders unrelated
- `getTopN()` function que retornaba constante → `const MAX_SLICES = 8`
- Código comentado `getUmbralPorcentaje` eliminado

#### Dashboard fixes
- `useMemo(() => getDefaultTimeRange(refDate), [])` → dependency array corregido a `[refDate]`
- `getDefaultTimeRange` refactored a usar `parseRefDateString` + `dateToKey` compartidos
- `ActiveFilterChips.fmtDate` → `formatDayKey(key, 'short')`

#### SalesHistoryChart cleanup
- `chartData = data` alias redundante eliminado
- Import de `dayKeyToLabel` → `formatDayKey` del módulo compartido

#### SalesComparisonChart fix
- Inline `todayKey` string construction → `dateToKey(new Date())`

#### TimeRangeFilter refactor
- Local `dateToKey`, `keyToDate` eliminados → importados de `utils/dateKeys`
- Inline refDate parsing en `getPreset`/`getThisYear` → helper `refDateToDate` que usa `parseRefDateString`

#### KPICards error handling
- `.catch(() => setLoading(false))` que tragaba errores silenciosamente → `.catch(() => { setKpis([]); setLoading(false) })`

#### Backend validate.ts
- `parseRefDate` ahora delega validación a `parseDateParam` — elimina duplicación de lógica de validación YYYYMMDD

#### App.css eliminado
- Boilerplate de Vite (`.logo`, `.read-the-docs`, `.card` con `padding: 2em`, `logo-spin`) — no importado por ningún archivo, `.card` podía colisionar con `index.css`

#### Lint pre-existentes (no introducidos)
- 2x `@typescript-eslint/no-explicit-any` en props de Recharts (CustomTooltip, CustomizedAxisTick)
- 2x `react-hooks/set-state-in-effect` en TopProductsChart y SalesComparisonChart — pendiente migrar a useReducer si se desea

---

### Sesión 18 Mar — P4 badge hora + P5 dateUtils + Hardening validación

#### P4: Badge "hasta X:00 hs" en `SalesComparisonChart.tsx`
- Badge solo visible si `!refDate || refDate === todayKey` (día real del servidor)
- `todayKey` calculado inline con `new Date()` — sin dependencia externa
- Bonus fix: `refDate` faltaba en el dependency array del `useEffect` (mismo bug de P2)

#### P5: `backend/src/utils/dateUtils.ts` — módulo compartido
- `toDayKey(date: Date): number` extraída a `backend/src/utils/dateUtils.ts`
- Eliminada la copia local en `salesComparison.ts` y `salesHistory.ts`
- Imports actualizados: `import { toDayKey } from '../utils/dateUtils'`

#### Hardening: validación contra inputs inválidos (3 capas)
- **Capa 1 — Gate en `App.tsx`:** `isValidRefDate()` valida 8 dígitos + fecha calendario real (no 20001332). Si falla → `refDate = null`
- **Capa 2 — `keyToDate()` defensiva en `TimeRangeFilter.tsx`:** valida `s.length === 8` + `isNaN(date.getTime())`. Fallback → `new Date()`
- **Capa 3 — `ErrorBoundary.tsx` (nuevo):** React class component que captura errores de render. Muestra UI "Algo salió mal" + botón recargar, mismo estilo visual que pantalla de empkey faltante
- Descubrimiento: validación backend `from > to` ya existía en `salesHistory.ts` líneas 53-57

#### P8: Winston logging — `backend/src/logger.ts`
- **Nuevo archivo:** `backend/src/logger.ts` — Winston con formato JSON estructurado
- **Transports:**
  - `error-YYYY-MM-DD.log` — solo nivel error, retención 30 días, max 10MB
  - `combined-YYYY-MM-DD.log` — todos los niveles, retención 14 días, max 20MB
  - Console con colores (solo en dev, no en producción)
- **Dependencias:** `winston`, `winston-daily-rotate-file`
- **13 console calls migrados en 6 archivos:**
  - `index.ts` — startup info, CORS warn, error global
  - `db.ts` — fatal config, pool error. **Eliminado `console.log(DATABASE_URL)` que leakeaba credenciales**
  - `auth.ts` — API key missing
  - `branches.ts`, `products.ts`, `salesHistory.ts`, `topProducts.ts`, `salesComparison.ts` — error de query con contexto (`empkey`)
- **Logs en QA:** `/var/www/pos-dashboard/backend/logs/`
- **Metadata estructurada:** cada error incluye `{ error, empkey }` para filtrado

---

## 2. Decisiones de diseño tomadas

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

### `toDayKey` local en `salesHistory.ts`
- No estaba exportada en `salesComparison.ts` — **decisión pendiente**: mover a `dateUtils.ts`

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

### `showPopperArrow={false}` sobre CSS hack
- Usar prop nativo del componente es preferible a `.react-datepicker__triangle { display: none }`
- Si el componente cambia la clase interna en una versión futura, el prop sigue funcionando

### `:focus-visible` sobre `:focus` para inputs
- `:focus` muestra ring en click de mouse (innecesario) — `:focus-visible` solo con teclado
- Recomendación de Web Interface Guidelines (Vercel)

### `::before` gradient line en el popup del datepicker
- Mismo patrón visual que `.card` y `.kpi-card` para cohesión con el ocean theme
- Decisión validada contra frontend-design skill

---

## 3. Conceptos clave aprendidos

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

---

## 4. Bugs encontrados y cómo se resolvieron

### Tooltip desincronizado en SalesHistoryChart
- **Síntoma:** Hover sobre `15/02/2026` mostraba datos de `15/02/2024`
- **Causa:** `dataKey="label"` (string `"15/02"`) — colisión entre mismas fechas de distintos años
- **Solución:** `dataKey="day"` (número YYYYMMDD, único por definición)

### Eje X ilegible con rangos largos
- **Síntoma:** 470+ días generaban ticks pisados
- **Solución:** `minTickGap={40}` + `CustomizedAxisTick` con rotación -30° + `margin bottom: 20`

### TopProductsChart — "Otros" dominaba el gráfico (69–70%)
- **Síntoma:** Con 176–296 productos, "Otros" era la categoría dominante
- **Causa:** `topN=7` fijo no escala con distribuciones de cola larga
- **Solución:** Cobertura acumulada con `COBERTURA_OBJETIVO=0.80` y `MAX_SLICES=8`

### API retornaba HTML en lugar de JSON
- **Síntoma:** `Unexpected token '<'. "<!doctype ..." is not valid JSON`
- **Causa:** `rewrite` + `alias` — Nginx servía `index.html` en lugar de proxear
- **Solución:** `proxy_pass` directo; location API antes del location del frontend

### PM2 daba EACCES al crear `.pm2/logs`
- **Síntoma:** `permission denied, mkdir '/home/dashboardapp/.pm2/logs'`
- **Causa:** Usuario sin home directory o sin permisos
- **Solución:** `mkdir -p /home/dashboardapp/.pm2/{logs,pids,modules}` + `chown -R dashboardapp:dashboardapp`

### `nginx -t` fallaba con `No such file or directory`
- **Síntoma:** `open() "/etc/nginx/sites-enabled/default" failed`
- **Causa:** Symlink `default` borrado pero referenciado en `nginx.conf`
- **Solución:** `sudo ln -s /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default`

### Duplicate default server
- **Síntoma:** `a duplicate default server for 0.0.0.0:80`
- **Causa:** Dos bloques con `listen 80 default_server`
- **Solución:** No usar `default_server` en `pos-dashboard`

### 401 desde browser, 200 desde curl directo
- **Síntoma:** Todos los fetch daban 401 desde `pos16.qa.andespos.com`
- **Causa:** Nginx externo eliminaba el header `x-api-key`
- **Solución:** `proxy_set_header x-api-key $http_x_api_key` en Nginx externo

### Build del frontend fallaba en servidor QA
- **Síntoma:** `Cannot find type definition file for 'vite/client'`
- **Causa:** `npm install --omit=dev` no instaló Vite ni TypeScript
- **Solución:** `npm install` completo antes de `npm run build`

### `self-signed certificate` — 500 en todas las APIs
- **Síntoma:** Todas las APIs retornaban 500 en QA
- **Causa:** `rejectUnauthorized: true` — PostgreSQL QA usa certificado autofirmado
- **Solución:** `rejectUnauthorized: false` en `db.ts`

### `currentHour = refDate.getHours()` retornaría siempre 0
- **Síntoma:** Detectado en análisis — no llegó a producción
- **Causa:** `refDate` llega como `YYYYMMDD` sin componente horario
- **Solución:** `currentHour = new Date().getHours()`

### Naming collision `refDate`
- **Síntoma:** Error de compilación TypeScript
- **Causa:** Variable resultado con mismo nombre que el query param
- **Solución:** `refDateRaw` + `refDateParsed`

### Filtros de período ignoraban `refDate`
- **Síntoma:** Presets siempre anclaban `to` en el día real
- **Causa:** `getPreset()` llamaba `new Date()` internamente
- **Solución:** `getPreset(days, refDate)` con patrón `refDate ? parseRef : new Date()`

### `refDate` faltaba en dependency arrays de `useEffect`
- **Síntoma:** Detectado en revisión de código — no llegó a producción visible porque `refDate` viene de URL y no cambia en runtime
- **Causa:** Al implementar `refDate` en `SalesHistoryChart` y `TopProductsChart`, se agregó al fetch call pero se olvidó en el dependency array del `useEffect`
- **Solución:** Agregar `refDate` al array: `[empkey, ubicod, timeRange.from, timeRange.to, products, refDate]`

### PM2 startup generó servicio con `User=--hp`
- **Síntoma:** `systemctl list-units | grep pm2` no retornaba nada, servicio nombrado `pm2---hp.service`
- **Causa:** Comando `pm2 startup systemd -u --hp /home/dashboardapp` — el flag `-u` tomó `--hp` como valor en vez del username
- **Solución:** Limpiar servicio roto (`systemctl disable` + `rm` + `daemon-reload`), recrear con `-u dashboardapp --hp /home/dashboardapp`

---

## 5. Pendientes para próximas sesiones

### ✅ Resueltos en sesión 18 Mar (pendientes críticos)

- ~~**P1 — `react-datepicker` para formato DD/MM/YYYY**~~ → Implementado con locale `es`, ocean theme CSS, accesibilidad (aria-label, focus-visible, touch-action)
- ~~**P2 — pm2 startup para `dashboardapp`**~~ → `pm2-dashboardapp.service` enabled + `dump.pm2` saved. Pendiente verificar con reboot real.
- ~~**P3 — Verificar `SalesHistoryChart` y `TopProductsChart` reciben `refDate`**~~ → Verificado: Props, fetch y useEffect deps correctos. Fix aplicado: `refDate` faltaba en dependency arrays.

### ✅ Resueltos en sesión 18 Mar (pendientes media prioridad)

- ~~**P4 — Badge "hasta X:00 hs" en `SalesComparisonChart`**~~ → Solo visible si `!refDate || refDate === hoy`. Bonus: `refDate` agregado a useEffect deps.
- ~~**P5 — `dateUtils.ts` — módulo compartido**~~ → `backend/src/utils/dateUtils.ts` con `toDayKey` exportada. Imports actualizados en `salesComparison.ts` y `salesHistory.ts`.
- ~~**P6 — Validación backend `from > to`**~~ → Ya existía en `salesHistory.ts` líneas 53-57. No requirió cambios.
- **Hardening extra** — `isValidRefDate()` en App.tsx, `keyToDate()` defensiva, `ErrorBoundary.tsx` global. Descubierto en QA con inputs inválidos.

### ✅ Resueltos en sesión 18 Mar (baja prioridad)

- ~~**P8 — Winston logging**~~ → `backend/src/logger.ts` con daily rotate. 13 console calls migrados. Leak de DATABASE_URL eliminado.

### ✅ Resueltos en sesión 19 Mar (refactor /simplify)

- ~~**P12 — Duplicate `fetchSalesHistory` (KPICards + SalesHistoryChart)**~~ → Dashboard owns fetch con `useReducer`, ambos reciben data como props. -50% requests al endpoint más usado.
- ~~**P13 — Clock 60s re-render de todo Dashboard**~~ → Extraído a `<Clock />` component aislado. Solo el reloj se actualiza cada minuto.
- ~~**P14 — Shared utils frontend**~~ → `utils/format.ts` (formatCLP, formatCLPFull) + `utils/dateKeys.ts` (dateToKey, keyToDate, parseRefDateString, formatDayKey). Elimina ~17 duplicaciones en 9 archivos.
- ~~**P15 — ThemeContext value instability**~~ → Provider value en `useMemo`/`useCallback`, evita re-renders innecesarios en consumers.
- ~~**P16 — TopProductsChart "Otros" sin memoizar**~~ → Grouping logic envuelto en `useMemo([raw])`.
- ~~**P17 — `useMemo` dependency bug en Dashboard**~~ → `getDefaultTimeRange(refDate)` tenía `[]` vacío, corregido a `[refDate]`.
- ~~**P18 — Dead code (App.css, getTopN, comentarios)**~~ → Eliminados.
- ~~**P19 — Backend `parseRefDate` duplicaba validación**~~ → Ahora delega a `parseDateParam`.

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

**P10 — Tests de integración** — Vitest + Supertest para los 5 endpoints

**P11 — Evaluar `COBERTURA_OBJETIVO`** — actualmente 80% en TopProductsChart · validar con el negocio

**P20 — Consolidar 5 queries de salesComparison en 1** — actualmente `Promise.all` con 5 queries al mismo table (1 por anchor day). Podría ser 1 query con `WHERE (dwphorakey/100) = ANY($N::int[])` + `GROUP BY`. Reduce 5 conexiones de pool a 1 por request.

**P21 — AbortController en fetches** — ningún `useEffect` usa `AbortController`. Cambios rápidos de filtro pueden causar race conditions (respuesta vieja llega después de la nueva). Aplica a Dashboard (salesHistory), TopProductsChart, SalesComparisonChart.

**P22 — Lint pre-existentes** — 2x `any` en Recharts props (CustomTooltip, CustomizedAxisTick), 2x `set-state-in-effect` en TopProductsChart y SalesComparisonChart. Migrar a `useReducer` como se hizo en Dashboard.

**P23 — Rate limiter demasiado restrictivo** — 100 req/15min. Page load = ~5 calls, cada filtro = ~3 calls. Usuario activo puede agotar en ~4 min. Considerar subir a 300-500 o implementar caching.

---

## Lecciones aprendidas — Nginx

| Concepto | Regla |
|----------|-------|
| `alias` vs `proxy_pass` | `alias` = archivos locales. `proxy_pass` = otro servidor |
| `server_name` | Filtro activo — debe incluir el dominio externo |
| `sites-available` vs `sites-enabled` | available = archivo real (NUNCA borrar). enabled = symlink |
| Headers custom en proxy | Nginx elimina headers no estándar — siempre repassar con `proxy_set_header` |
| `default_server` | Solo un bloque puede tenerlo por puerto |
| PM2 y variables de entorno | `pm2 restart --update-env` para recargar variables desde .env |
| Frontend build en servidor | Requiere `npm install` completo (con devDeps) antes de `npm run build` |
| Order de locations | Location de API debe ir antes que el del frontend |

---

## Lecciones aprendidas — Frontend (Recharts)

**Identificador ≠ Presentación**
`dataKey` del `XAxis` debe ser único. `tickFormatter` y `CustomTooltip` son para display.

**`tick` custom vs `tickFormatter`**
Mutuamente excluyentes. Con `tick={<CustomizedAxisTick />}`, transformar con `payload.value`.

**Distribuciones de cola larga**
`topN` fijo no escala. Usar cobertura acumulada: `COBERTURA_OBJETIVO=0.80`, `MAX_SLICES=8`.

---

## Lecciones aprendidas — Frontend (react-datepicker)

**`dateFormat` fuerza el formato de display**
`input[type="date"]` delega al browser. `react-datepicker` con `dateFormat="dd/MM/yyyy"` lo fuerza independiente del locale del OS.

**Locale con `date-fns`**
`registerLocale('es', es)` a nivel módulo (fuera del componente). `locale="es"` en cada `<DatePicker>`. Los meses salen en lowercase → usar `text-transform: capitalize` en CSS.

**`showPopperArrow={false}` sobre CSS hack**
Prop nativo del componente. Más resiliente que ocultar con CSS la clase interna `.react-datepicker__triangle`.

**Theming con CSS custom properties**
Override de `.react-datepicker*` clases usando `var(--bg-surface)`, `var(--border-card)`, etc. Adapta dark/light automáticamente sin JavaScript.

**`spellCheck` no es prop de `<DatePicker>`**
A diferencia de `<input>`, el componente no expone `spellCheck`. Detectado por TypeScript strict mode.

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

## Instrucciones para la próxima sesión de Claude

### Archivos a pedir ANTES de diagnosticar

| Tarea / Síntoma | Archivos a pedir |
|----------------|-----------------|
| Datepicker styling / bugs | `frontend/src/components/filters/TimeRangeFilter.tsx` + `frontend/src/index.css` |
| Badge hora | `frontend/src/components/charts/SalesComparisonChart.tsx` |
| `dateUtils.ts` | `backend/src/utils/dateUtils.ts` |
| Validación backend | `backend/src/routes/salesHistory.ts`, `backend/src/middleware/validate.ts` |
| Error en gráficos | `frontend/src/components/charts/[Chart].tsx` |
| 401 / autenticación | `backend/src/middleware/auth.ts` + `frontend/src/api/client.ts` |
| Logging / errores backend | `backend/src/logger.ts` + logs en `/var/www/pos-dashboard/backend/logs/` |
| Crash frontend / pantalla blanca | `frontend/src/components/ErrorBoundary.tsx` + `frontend/src/App.tsx` |
| Nginx no sirve | `cat /etc/nginx/sites-enabled/pos-dashboard` |
| PM2 no levanta | `tail /var/www/pos-dashboard/backend/logs/error-*.log` o `pm2 logs pos-backend` |

### Lo que NO debe asumir Claude

- No asumir que el `dist/` del servidor QA está sincronizado con la VM
- No asumir que PM2 tomó nuevas variables sin `--update-env`
- No asumir que Nginx recargó config sin `sudo systemctl reload nginx`
- No diagnosticar sin ver el código real — siempre pedirlo primero

### Contexto crítico que no está en el código

- `refDate` llega como `YYYYMMDD` sin componente horario — `getHours()` siempre retorna `0`
- `isToday` compara contra `new Date()` real, **no contra `refDate`** — esto es intencional
- `effectiveTo` en `salesHistory.ts` siempre tiene valor — no es opcional
- Sin `refDate` en la URI, la app se comporta exactamente igual que antes — parámetro aditivo no destructivo
- `toDayKey` ahora en `backend/src/utils/dateUtils.ts` — importada por ambas rutas
- `TimeRangeFilter` ahora usa `react-datepicker` con `date-fns` — ya no tiene `input[type="date"]`
- CSS del datepicker está en `index.css` usando CSS custom properties — adapta dark/light automáticamente
- `dateToKey()` y `keyToDate()` ahora en `frontend/src/utils/dateKeys.ts` — módulo compartido. `keyToDate` es defensiva (fallback a `new Date()` si input inválido)
- `parseRefDateString()` en `utils/dateKeys.ts` reemplaza `isValidRefDate()` — valida YYYYMMDD y retorna `Date | null`
- `formatDayKey(key, format)` en `utils/dateKeys.ts` — formatea YYYYMMDD en 3 formatos: 'short' (DD/MM), 'medium' (DD/MM/YY), 'long' (DD/MM/YYYY)
- `formatCLP` y `formatCLPFull` ahora en `frontend/src/utils/format.ts` — `Intl.NumberFormat` hoisted a module scope
- **Dashboard owns `fetchSalesHistory`** — KPICards y SalesHistoryChart reciben data/loading/error como props, NO hacen fetch propio
- `<Clock />` es un componente aislado dentro de Dashboard.tsx — el interval de 60s solo re-renderiza el reloj
- `ErrorBoundary.tsx` envuelve `<Dashboard>` — errores de render muestran UI de fallback, no pantalla blanca
- Logging backend usa Winston (`backend/src/logger.ts`) — no `console.log`. Logs en `backend/logs/`
- `db.ts` ya NO loguea `DATABASE_URL` — eliminado por riesgo de exposición de credenciales

### Metodología del equipo
- Developer aprende haciendo → concepto + pista antes de solución completa
- Código completo solo si se pide explícitamente o tras varios intentos fallidos
- Stack: React + Vite + TypeScript + Recharts + Tailwind · Express 5 + TypeScript + PostgreSQL · Nginx + PM2 + Debian 12
- Formato fechas en display: siempre `DD/MM/AA` o `DD/MM/AAAA`
