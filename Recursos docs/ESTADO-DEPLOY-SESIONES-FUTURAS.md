# POS Dashboard — Estado del Deploy y Contexto para Sesiones Futuras
> Última actualización: 14 Abril 2026
> Integra sesiones: 16 Mar (bugs Recharts) · 18 Mar (deploy QA) · 18 Mar (feature refDate) · 18 Mar (pendientes críticos P1–P3) · 19 Mar (refactor /simplify — dedup, performance, shared utils) · 19 Mar (P20 query consolidada + P23 rate limiter/cache + P10 tests) · 19 Mar (P21 AbortController en fetches) · 08 Abr (doc: fix 404 post-WinSCP manual deploy) · 08 Abr (debug: API key mismatch local↔QA → 401 + crash cascada) · 09 Abr (fix fetchSalesComparison fallback + limpieza docs) · 09 Abr (P22 lint Recharts any→tipos + useReducer) · 09 Abr (P24 tests 21→89) · 09 Abr (fix dark mode contrast — text-label/chart-axis legibles) · 10 Abr (fix build Recharts 3 types + deploy pos-prod-sim pasos 1–7) · 10 Abr (P25: pos-prod-sim backend online con túnel PuTTY Windows→DB + commit historial completo) · 10 Abr (P25 completo: smoke tests + PM2 startup systemd + reboot verificado) · 14 Abr (auditoría WCAG AA dark mode — 7 fixes contraste + playbook producción)

---

## Estado actual del proyecto

| Componente | Estado | Nota clave |
|-----------|--------|------------|
| App QA completa | ✅ Funcional | https://pos16.qa.andespos.com/POSdashboard2603/ |
| Backend Express + PM2 | ✅ Online | 10.50.10.5 · pm2-dashboardapp.service enabled |
| Frontend dist/ + Nginx | ✅ Servido | Nginx interno 10.50.10.5 + Nginx externo pos16.qa.andespos.com |
| DB PostgreSQL | ✅ Conectada | localhost:5432 · DB: pos · schema: pos2407 |
| Tests backend | ✅ 89/89 | Vitest + Supertest · `cd backend && npm test` |
| pos-prod-sim (192.168.56.101) | ✅ Online | PM2 startup ok · depende de túnel PuTTY en Windows |
| Dark mode WCAG AA | ✅ Auditado | 7 fixes contraste · todos ≥4.5:1 sobre bg-card |
| Servidor QA — limpieza | ✅ Limpio | Sin `src/` en frontend ni backend · permisos corregidos |
| Playbook Producción | ✅ Listo | `Recursos docs/Playbook-Produccion.md` · falta completar placeholders |
| HTTPS / Certbot | ⏳ Pospuesto | Riesgo Nginx externo + panel embedded |
| Token Tomcat | ⏳ Bloqueado | Pendiente definición con dev senior |

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

## Fix 404 después de deploy manual WinSCP

**Síntoma:** Se subieron `backend/dist/` y/o `frontend/dist/` via WinSCP sin ejecutar `deploy.sh`. El browser muestra 404.

**Causa raíz:** pm2 y Nginx no se restartearon — siguen sirviendo el código viejo en memoria.

- **pm2** carga `backend/dist/index.js` en memoria al arrancar y no lo relee automáticamente al sobreescribirse el archivo.
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

## 1. Historial de sesiones — resumen

| Sesión | Área | Cambios principales |
|--------|------|---------------------|
| 10 Abr | P25 completo — pos-prod-sim | Smoke tests OK (frontend 200, API con datos reales). PM2 startup systemd configurado (`pm2-dashboardapp.service` enabled). `pm2 save` ejecutado. Reboot verificado: pos-backend online automáticamente. Bug descubierto: PM2 sin `--cwd` crashea con "DATABASE_URL no configurada" porque usa home dir como CWD. Fix: `pm2 start ... --cwd /var/www/pos-dashboard/backend`. |
| 10 Abr | Fix build + deploy pos-prod-sim | Fix Recharts 3 types: `TooltipContent` interfaz local, `CustomizedAxisTick` con `...args: any[]`, `content={<CustomTooltip />}`. `tsconfig.json` excluye `*.test.ts`. `frontend/.env.production` con key de prod. Deploy a pos-prod-sim (192.168.56.101): WinSCP + permisos + .env + npm install + PM2 online + Nginx configurado. `Manual Deploy Dashboard.md` creado. |
| 14 Abr | Auditoría WCAG AA + playbook prod | 7 fixes contraste WCAG AA dark mode. Limpieza servidor QA (`src/` eliminado). `Playbook-Produccion.md` creado. Commit `1a7ca49`. |
| 09 Abr | Fix + refactor + tests | `fetchSalesComparison` fallback defensivo. P22: lint Recharts any→tipos + useReducer. P24: 21→89 tests. Dark mode contrast fix inicial (text-label, chart-axis). |

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

### `VITE_*` se bake en el bundle en build time — no en runtime
Las variables `VITE_API_SECRET_KEY` se resuelven durante `npm run build`, no al cargar la app en el browser. Si el backend de producción tiene una key distinta a la que había en `frontend/.env` al compilar, todos los requests llegarán con credencial incorrecta → 401. Verificar siempre que ambas keys coincidan **antes** del build del frontend.

### `?.` no protege cuando el objeto raíz es `undefined`
`data[0]?.total ?? 0` — si `data` es `undefined` (no `[]`), el acceso `data[0]` ya lanza `TypeError` antes de que `?.` pueda actuar. El optional chaining solo protege la cadena **después** del punto. Siempre usar fallbacks en fetch (`json.data ?? []`) para garantizar que el estado inicial de los componentes sea el tipo correcto, no `undefined`.

---

## 4. Bugs encontrados y resueltos

> Catálogo completo en `Recursos docs/FAQ Bugs Comandos diarios.md` — incluye síntoma, causa, solución y comandos de diagnóstico para cada bug histórico (Recharts, Nginx, PM2, dark mode, PostgreSQL, refDate).

---

## 5. Pendientes para próximas sesiones

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

**P11 — Evaluar `COBERTURA_OBJETIVO`** — actualmente 80% en TopProductsChart · validar con el negocio

---

---

## Lecciones aprendidas — Recharts 3 (TypeScript)

**`TooltipProps` en Recharts 3 omite `active`, `payload` y `label`**
En v3, `TooltipProps<TValue, TName>` hace `Omit<..., 'active' | 'payload' | 'label' | ...>` — esas props son "leídas del contexto" y no están en el tipo. Usar una interfaz local simple: `interface TooltipContent { active?: boolean; payload?: Array<{ value: number }>; label?: string }`. No importar `TooltipProps` ni `TooltipContentProps` para componentes custom.

**`CustomizedAxisTick` — patrón oficial con `...args`**
Recharts inyecta las props (`x`, `y`, `payload`) en runtime. TypeScript no lo sabe al escribir `<CustomizedAxisTick />` (ve `{}`). Patrón oficial de docs: `(...args: any[]) => { const { x, y, payload } = args[0] as { x: number; y: number; payload: { value: number } }; }`. El `any` está acotado al boundary con Recharts; el interior del componente queda tipado.

**`content={<CustomTooltip />}` es el patrón correcto**
No usar render functions (`content={(props) => <CustomTooltip {...props} />}`) — TypeScript falla por contravarianza de genéricos. El JSX element directo funciona cuando el componente tiene una interfaz local simple (no importada de Recharts).

**SIEMPRE consultar context7 antes de iterar con tipos de librerías externas**
Recharts 3 cambió sus tipos significativamente respecto a v2. Sin consultar docs, se itera a ciegas. Regla: primer error de tipos de librería externa → abrir context7, no razonar desde memoria.

**`tsconfig.json` backend debe excluir archivos de test**
`"exclude": ["node_modules", "dist", "src/**/*.test.ts", "src/test/**/*"]` — sin esto, `tsc` compila los tests en el build de producción y falla si usan features como `top-level await` incompatibles con el `module: commonjs` de producción.

**`frontend/.env.production` separa keys por entorno**
Vite carga `.env.production` solo en `npm run build`, `.env` en dev. Crear `.env.production` con la key del servidor destino evita el riesgo de buildear con key incorrecta y tener 401 en producción.

**`npm install --omit=dev` requiere `package.json` en el servidor**
Transferir solo `dist/` no es suficiente. El servidor necesita `package.json` (y `package-lock.json` para builds deterministas) para que `npm install` sepa qué instalar. Agregar ambos archivos al procedimiento de WinSCP.

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

## Lecciones aprendidas — Frontend (AbortController)

**AbortController en `useEffect` — patrón estándar para fetch cancelable**
Crear `new AbortController()` al inicio del efecto, pasar `controller.signal` al `fetch()`, y llamar `controller.abort()` en la cleanup function. Cuando React re-ejecuta el efecto (cambio de deps), la cleanup aborta el fetch pendiente antes de lanzar uno nuevo.

**`isAbortError` como guard en `.catch()`**
`fetch()` lanza `DOMException` con `name === 'AbortError'` cuando se aborta. Sin el guard, el `.catch` trataría la cancelación intencional como un error real y mostraría mensaje de error al usuario. El patrón correcto: `.catch(e => { if (!isAbortError(e)) handleError(e) })`.

**Requests `(cancelled)` en DevTools son señal de éxito, no de error**
Chrome muestra `(cancelled)` con `0 kB` para fetches abortados. Esto confirma que AbortController está funcionando — el browser cortó la conexión antes de recibir respuesta completa. Solo la última request (la vigente) completa con datos.

---

## Lecciones aprendidas — Frontend (TypeScript + Recharts)

**`TooltipProps<ValueType, NameType>` para custom tooltips de Recharts**
Recharts exporta `TooltipProps<TValue, TName>` (importar con `import type { TooltipProps } from 'recharts'`). Elimina el `any` en el prop `content` de `<Tooltip>`. Usar `TooltipProps<number, number>` cuando label es un dayKey numérico, `TooltipProps<number, string>` cuando es texto (e.g. "Hoy", "Ayer").

**Interface inline para tick components de XAxis**
Recharts no exporta un tipo público para los props del tick custom. Solución: interface local `{ x: number; y: number; payload: { value: T } }`. Más simple y portable que intentar importar tipos internos de recharts.

**`useReducer` en lugar de múltiples `useState` en `useEffect`**
Cuando un `useEffect` llama 3+ setters distintos (`setLoading`, `setData`, `setError`), cada setter dispara un re-render separado. `useReducer` con `dispatch` atómico es más correcto: definir acciones FETCH_START / FETCH_SUCCESS / FETCH_ERROR → una sola actualización por fase. Además elimina el lint warning `set-state-in-effect`. Patrón ya establecido en Dashboard.tsx — replicar en cualquier chart que tenga su propio fetch.

---

## Lecciones aprendidas — Tests (Vitest)

**`vi.importActual` para testear módulos mockeados en `setupFiles`**
Si `setupFiles` mockea un módulo globalmente (e.g. `cache.ts`), todos los tests solo ven el mock. Para testear la implementación real del módulo: `const { cacheMiddleware } = await vi.importActual<typeof import('./cache')>('./cache')`. Llamar en `beforeAll`. Esencial para tests unitarios de middlewares que el resto del suite necesita desactivados.

**Patrón helper `mockRes()` para tests de middlewares Express**
Para testear funciones que reciben `(req, res, next)` sin Supertest: crear mocks mínimos con `vi.fn()`. El `res.status` debe retornar `res` para permitir `res.status(400).json(...)`. Pattern: `res.status = vi.fn().mockReturnValue(res); res.json = vi.fn().mockReturnValue(res);`. Verificar que `next` no fue llamado cuando se espera un 4xx.

---

## Lecciones aprendidas — Backend (PostgreSQL + node-postgres)

**PostgreSQL rechaza parámetros no referenciados en el SQL**
Si un `$N` está en el array de `params` pero no aparece en la query, PostgreSQL retorna "no se pudo determinar el tipo del parámetro $N". Solución: solo pushear params que se van a usar. En salesComparison, `currentHour` solo se pushea si `needsHourFilter === true`.

**node-postgres: preferir `IN ($1, $2)` sobre `ANY($1::type[])`**
La FAQ de node-postgres muestra dos formas de manejar arrays. `= ANY($1)` con array anidado requiere que pg serialice el array como string literal, y el cast explícito `::bigint[]` puede fallar. `IN ($1, $2, $3)` con params planos es más seguro y explícito. Verificado contra context7.

**Siempre correr tests antes de entregar código**
El bug del parámetro huérfano solo se manifestaba con `refDate` pasado (no hoy). Sin tests automatizados, pasó a producción local. Con el test `pool.query recibe parámetros sin huecos`, el bug se detecta inmediatamente.

**Cache middleware con `res.json` override es transparente**
Override de `res.json` en Express 5 funciona correctamente (verificado con context7). Solo cachear 2xx, nunca errores. Limpieza periódica del Map previene memory leak. Desactivar con mock passthrough en tests.

---

## Lecciones aprendidas — Frontend (Dark Mode y contraste)

**`--text-label` y `--chart-axis` dark mode deben ser ≥5:1 contra #060b18**
Los colores "de relleno" del dark mode de Tailwind (slate-700 #334155, slate-600 #475569) tienen ratio de contraste de 2–3:1 contra el fondo dark `#060b18`. No son legibles como texto. Para labels y ejes, usar #718096 (slate-500, ratio 5.0:1) como mínimo.

**Colores hardcodeados en subcomponentes rompen el theming**
`CustomizedAxisTick` con `fill="#6b7280"` hardcodeado ignora ThemeContext — en dark mode queda con un azul grisáceo del light mode, en light mode también estático. Siempre usar `const { colors } = useTheme()` dentro del componente y referenciar `colors.chartAxis`. Aplica a cualquier subcomponente que renderice texto de ejes o labels con Recharts.

**Light mode y dark mode deben definirse en dos lugares separados**
Los valores de colores Recharts viven en `ThemeContext.tsx` (`DARK_COLORS`/`LIGHT_COLORS`) **y** en `index.css` (`:root` dark / `[data-theme="light"]`). Un cambio de contraste requiere actualizar ambos archivos para que CSS variables y ThemeContext queden sincronizados.

**Diagnóstico rápido de contraste WCAG**
Ratios objetivo: texto normal ≥4.5:1 (AA), texto grande ≥3:1 (AA), decorativo ≥3:1 (trade-off aceptable). Calcular con: `(L1 + 0.05) / (L2 + 0.05)` donde `L1` = luminancia mayor. Para fondo `#060b18` (L≈0.002), cualquier color con L≥0.11 alcanza 4.5:1. El blue-gray del ocean theme #718096 tiene L≈0.19 → ratio 5.0:1 ✅.

**bg-card (~#0c1a35, L≈0.011) es más oscuro que bg-page y exige colores más claros**
`--text-muted` (#5a7a96) da 4.5:1 contra bg-page pero solo 3.8:1 contra bg-card. Para texto informacional sobre cards, usar `--text-mid` (#94a3b8, 6.7:1) o verificar que el color pase 4.5:1 contra L=0.011. Regla: necesitás L≥0.225 para pasar 4.5:1 contra bg-card.

**Separar fill decorativo de color de texto en charts**
`COLOR_OTROS = '#4b5563'` da 2.3:1 sobre bg-card — ilegible para texto. Solución: mantener el hex oscuro para el fill del pie (decorativo, 3:1 no requerido en shapes), pero para texto de leyenda usar `--text-muted` y para labels externos `--text-mid`. No reutilizar el color de fill directamente como `style={{ color }}` si ese color es oscuro.

**Tooltip bg (#0d1e3a, L≈0.012) necesita colores más claros que bg-page**
Labels de fecha/nombre dentro del tooltip deben usar `--text-mid`, no `--text-muted`. El fondo del tooltip es ligeramente más oscuro que bg-card, así que los mismos colores que fallan en cards también fallan en tooltips.

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
| Tests / nuevo endpoint | `backend/src/test/setup.ts` + cualquier `*.test.ts` en `src/routes/` o `src/middleware/` |
| Cache backend | `backend/src/middleware/cache.ts` + `backend/src/index.ts` (líneas 56-58) |

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
- **salesComparison usa 1 query consolidada** con `SUM(CASE WHEN ...)` + `WHERE IN` — NO `Promise.all` con 5 queries
- **`needsHourFilter`** controla si `currentHour` se pushea a params — NUNCA pushear params que no se referencian en el SQL
- **NO usar `ANY($N::bigint[])` con pg** — usar `IN ($a, $b, $c)` con params individuales (verificado con context7/node-postgres FAQ)
- **Cache middleware** en `backend/src/middleware/cache.ts` — TTL 60s, solo 2xx, key = `req.originalUrl`
- **Rate limiter** ahora 300 req/15min (era 100)
- **Tests:** `cd backend && npm test` — 89 tests, 8 archivos, pool mockeado, cache desactivado en tests
- **`index.ts` exporta `{ app }`** y no llama `listen()` en `NODE_ENV=test` — requisito de Supertest
- **AbortController en los 3 fetches de charts** — `client.ts` acepta `AbortSignal`, cada `useEffect` crea controller + cleanup `abort()`. `isAbortError()` en `client.ts` distingue cancelaciones de errores reales. Requests `(cancelled)` en DevTools = comportamiento esperado.
- **`useReducer` en SalesComparisonChart y TopProductsChart** — ya NO usan `useState` individual para loading/data/error. Usan `useReducer` con acciones FETCH_START/SUCCESS/ERROR. Al agregar fetches nuevos, seguir este patrón.
- **`TooltipProps` de Recharts** — importar con `import type { TooltipProps } from 'recharts'`. `TooltipProps<number, number>` para SalesHistoryChart (label = dayKey numérico), `TooltipProps<number, string>` para SalesComparisonChart (label = texto). No usar `any`.
- **PM2 `--cwd` es obligatorio en pos-prod-sim** — `pm2 start dist/index.js --name pos-backend --cwd /var/www/pos-dashboard/backend`. Sin `--cwd`, PM2 usa el home del usuario como working directory y dotenv no encuentra el `.env` → crash con "DATABASE_URL no configurada"
- **PM2 startup en pos-prod-sim**: usar `pm2 startup systemd -u dashboardapp --hp /home/dashboardapp` directamente como root (sin `sudo env` wrapper — sudo no está instalado en esta VM)
- **pos-prod-sim reboot**: el backend sobrevive reboot de VM siempre que PuTTY en Windows esté activo. Si PuTTY se cierra, PM2 arranca pos-backend pero falla al conectar a la DB silenciosamente.
- **Dark mode contraste validado (14 Abr)**: `--text-very-muted` es ahora `#6e8fa8` (L≈0.258, ratio ~5:1 bg-card). `badge-neutral` usa `#8399b0`. Tooltips y lista de comparación usan `--text-mid`. Leyenda "Otros" en TopProducts: fill del pie sigue en `#4b5563`, texto usa `--text-muted`/`--text-mid`.
- **Servidor QA limpio (14 Abr)**: frontend en QA solo tiene `dist/`, `package.json`, `package-lock.json` y configs de build. Backend solo tiene `dist/`, `node_modules/`, `logs/`, `package.json`, `package-lock.json`, `.env`. No hay `src/` en ninguno de los dos.
- **Playbook de producción**: `Recursos docs/Playbook-Produccion.md`. Servidor prod: Debian 12, Tomcat en 8080 (no tocar), PostgreSQL local, Nginx en 80, Nginx externo delante. `API_SECRET_KEY` prod: `0c8ed4477e54bac978f5344182486283401ac21c44c6d40ee92d4ded4442bfeb`. Pendiente completar: dominio prod, IP prod, credenciales DB, coordinar Nginx externo con compañero.
- **Para el deploy a prod**: instalar Node 22 + PM2 + Nginx + crear `dashboardapp`. El `--cwd /var/www/pos-dashboard/backend` sigue siendo obligatorio en el `pm2 start`. El compañero del Nginx externo debe agregar `proxy_set_header x-api-key $http_x_api_key` — sin esto, 401 en todos los endpoints desde el dominio público.

### Metodología del equipo
- Developer aprende haciendo → concepto + pista antes de solución completa
- Código completo solo si se pide explícitamente o tras varios intentos fallidos
- Stack: React + Vite + TypeScript + Recharts + Tailwind · Express 5 + TypeScript + PostgreSQL · Nginx + PM2 + Debian 12
- Formato fechas en display: siempre `DD/MM/AA` o `DD/MM/AAAA`
