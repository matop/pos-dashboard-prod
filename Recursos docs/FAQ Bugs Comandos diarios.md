# FAQ — Bugs, Comandos Diagnóstico y Trampas Comunes
> POS Dashboard — referencia rápida para troubleshooting en el día a día
> Incluye: comandos operativos diarios + bugs históricos resueltos (síntoma → causa → solución)

---

## Diagnóstico rápido — Backend

```bash
# Ver si PM2 está corriendo
sudo -u dashboardapp HOME=/home/dashboardapp pm2 status

# Ver logs en tiempo real
sudo -u dashboardapp HOME=/home/dashboardapp pm2 logs pos-backend --lines 50

# Curl sin auth → debe responder 401 (confirma que el proceso está vivo)
curl -s http://localhost:3001/api/branches?empkey=1136

# Curl con auth → debe responder datos
API_KEY=$(grep API_SECRET_KEY /var/www/pos-dashboard/backend/.env | cut -d'=' -f2)
curl -s "http://localhost:3001/api/branches?empkey=1136" -H "x-api-key: $API_KEY"

# Reiniciar backend recargando .env
sudo -u dashboardapp HOME=/home/dashboardapp pm2 restart pos-backend --update-env
```

---

## Diagnóstico rápido — Nginx

```bash
# Verificar config antes de recargar
sudo nginx -t

# Recargar sin downtime
sudo systemctl reload nginx

# Ver logs de Nginx
sudo tail -50 /var/log/nginx/error.log
sudo tail -50 /var/log/nginx/access.log
```

---

## Bug: `{"error":"Error interno del servidor"}` en todos los endpoints

**Causa más común:** el backend no puede conectarse a PostgreSQL.

**Diagnóstico:**
```bash
# Ver el error real en logs
sudo -u dashboardapp HOME=/home/dashboardapp pm2 logs pos-backend --lines 30 --nostream

# Verificar qué DATABASE_URL está usando
grep DATABASE_URL /var/www/pos-dashboard/backend/.env

# Probar conexión al host/puerto de la DB
nc -zv <host-db> <puerto> 2>&1; echo "exit: $?"
```

**Causas frecuentes:**
- `DATABASE_URL` apunta a `localhost` pero no hay PostgreSQL local → cambiar al host correcto
- Puerto incorrecto (5432 vs 5433) → verificar con `nc`
- Túnel SSH no activo → ver sección "Túnel PuTTY"

---

## Bug: `{"error":"No autorizado"}` — 401

El header `x-api-key` no llegó o no coincide.

```bash
# Verificar key en backend
grep API_SECRET_KEY /var/www/pos-dashboard/backend/.env

# La key del frontend (bakeada en el build) debe coincidir exactamente
# Si el frontend fue buildeado con otra key → rebuild con la key correcta en .env.production
```

**Trampas:**
- Nginx externo debe pasar el header: `proxy_set_header x-api-key $http_x_api_key;`
- La key se bake en el bundle de Vite en tiempo de build (no en runtime)

---

## Túnel PuTTY desde Windows → DB remota (para VM VirtualBox)

**Contexto:** cuando el servidor de destino (ej. pos-prod-sim en 192.168.56.101) no tiene
acceso de red directo al servidor de DB (ej. 10.50.10.5), Windows puede actuar como relay
usando un túnel PuTTY.

**Arquitectura:**
```
VM (192.168.56.101) → Windows host (192.168.56.1:5433) → PuTTY tunnel → DB (10.50.10.5:5432)
```

**Configurar PuTTY:**
1. Connection → SSH → Tunnels
2. Source port: `0.0.0.0:5433` (el `0.0.0.0` es crítico — sin esto solo escucha en localhost)
3. Destination: `localhost:5432` (o el puerto real de PostgreSQL en el servidor DB)
4. Marcar: Local + IPv4
5. Activar: "Local ports accept connections from other hosts" ✓
6. **Cerrar y reconectar la sesión PuTTY** — los cambios solo aplican en conexiones nuevas

**Regla de Firewall en Windows (PowerShell como Admin):**
```powershell
New-NetFirewallRule -DisplayName "VirtualBox DB Tunnel" `
  -Direction Inbound -Protocol TCP -LocalPort 5433 `
  -RemoteAddress 192.168.56.0/24 -Action Allow
```

**Verificar que PuTTY está escuchando en todas las interfaces (no solo localhost):**
```powershell
netstat -an | findstr "5433"
# Debe mostrar: TCP  0.0.0.0:5433  LISTENING
# Si muestra:   TCP  127.0.0.1:5433  LISTENING → PuTTY no fue reconectado con nueva config
```

**Verificar desde la VM que el tunel es alcanzable:**
```bash
nc -zv 192.168.56.1 5433 2>&1; echo "exit: $?"
# exit: 0 = OK, exit: 1 = firewall bloqueando o PuTTY no escucha en 0.0.0.0
```

**`.env` del backend en la VM:**
```env
DATABASE_URL=postgresql://usuario:password@192.168.56.1:5433/nombre_db
```

**Limitación importante:** este túnel depende de que PuTTY esté abierto en Windows.
Si Windows se reinicia o PuTTY se cierra, el backend pierde la DB. No es apto para producción real.
Para producción usar autossh en el mismo servidor o acceso directo de red.

---

## Diagnosticar conectividad de red entre servidores

```bash
# Ping básico
ping -c 3 <ip-destino>

# Verificar puerto específico (nc debe estar instalado)
nc -zv <ip> <puerto> 2>&1; echo "exit: $?"

# Alternativa si nc no está disponible
timeout 5 bash -c "echo > /dev/tcp/<ip>/<puerto>" && echo "ABIERTO" || echo "CERRADO"
```

---

## PM2 — Comandos útiles

```bash
# Ver estado de todos los procesos
sudo -u dashboardapp HOME=/home/dashboardapp pm2 status

# Reiniciar recargando variables de entorno
sudo -u dashboardapp HOME=/home/dashboardapp pm2 restart pos-backend --update-env

# Ver logs en tiempo real
sudo -u dashboardapp HOME=/home/dashboardapp pm2 logs pos-backend

# Configurar startup systemd (ORDEN DE ARGS CRÍTICO)
sudo env PATH=$PATH:/usr/bin \
  sudo -u dashboardapp HOME=/home/dashboardapp \
  pm2 startup systemd -u dashboardapp --hp /home/dashboardapp
# Copiar y ejecutar el comando que imprime PM2

# Guardar procesos actuales para el startup
sudo -u dashboardapp HOME=/home/dashboardapp pm2 save
```

---

## Verificar que el frontend está siendo servido por Nginx

```bash
# Debe responder 200 con HTML
curl -I http://localhost/POSdashboard2603/

# Si responde 404 → revisar alias en nginx config y permisos del dist/
ls -la /var/www/pos-dashboard/frontend/dist/

# Permisos correctos post-WinSCP
sudo chown -R dashboardapp:dashboardapp /var/www/pos-dashboard/
sudo find /var/www/pos-dashboard/frontend/dist/ -type d -exec chmod 755 {} \;
sudo find /var/www/pos-dashboard/frontend/dist/ -type f -exec chmod 644 {} \;
sudo systemctl reload nginx
```

---

## Bugs históricos — Deploy / Nginx

### API retornaba HTML en lugar de JSON
- **Síntoma:** `Unexpected token '<'. "<!doctype ..." is not valid JSON`
- **Causa:** `rewrite` + `alias` combinados — Nginx servía `index.html` en lugar de proxear al backend
- **Solución:** `proxy_pass` directo al backend. El location `/api/` debe ir ANTES del location del frontend en la config de Nginx.

### Nginx `-t` fallaba con `No such file or directory`
- **Síntoma:** `open() "/etc/nginx/sites-enabled/default" failed`
- **Causa:** Symlink `default` borrado pero referenciado en `nginx.conf`
- **Solución:** `sudo ln -s /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default`

### Duplicate default server
- **Síntoma:** `nginx: [warn] a duplicate default server for 0.0.0.0:80`
- **Causa:** Dos bloques `server` con `listen 80 default_server`
- **Solución:** No agregar `default_server` al bloque de pos-dashboard.

### `self-signed certificate` — 500 en todas las APIs
- **Síntoma:** Todas las APIs retornaban 500 en QA
- **Causa:** `rejectUnauthorized: true` (default) — PostgreSQL QA usa certificado autofirmado
- **Solución:** `rejectUnauthorized: false` en `db.ts` (solo para entornos con cert autofirmado)

### Build del frontend fallaba en servidor
- **Síntoma:** `Cannot find type definition file for 'vite/client'`
- **Causa:** `npm install --omit=dev` no instala Vite ni TypeScript (son devDependencies)
- **Solución:** `npm install` completo (sin `--omit=dev`) si se construye en el servidor. En producción: construir local y subir solo `dist/`.

---

## Bugs históricos — PM2

### PM2 crash "DATABASE_URL no configurada"
- **Síntoma:** `pm2 start dist/index.js` → status `errored`, logs: `FATAL: DATABASE_URL no está configurada`
- **Causa:** Sin `--cwd`, PM2 usa el home del usuario como working directory. `dotenv.config()` busca `.env` en el CWD, no en el directorio del script.
- **Solución:** `pm2 start /var/www/pos-dashboard/backend/dist/index.js --name pos-backend --cwd /var/www/pos-dashboard/backend`

### PM2 startup generó servicio con `User=--hp`
- **Síntoma:** `systemctl list-units | grep pm2` retornaba `pm2---hp.service`, servicio no funcional
- **Causa:** `pm2 startup systemd -u --hp /home/dashboardapp` — el flag `-u` tomó `--hp` como valor del username
- **Solución:** Username SIEMPRE inmediatamente después de `-u`: `pm2 startup systemd -u dashboardapp --hp /home/dashboardapp`

### PM2 EACCES al crear `.pm2/logs`
- **Síntoma:** `permission denied, mkdir '/home/dashboardapp/.pm2/logs'`
- **Causa:** Usuario sin home directory correctamente inicializado
- **Solución:** `mkdir -p /home/dashboardapp/.pm2/{logs,pids,modules} && chown -R dashboardapp:dashboardapp /home/dashboardapp/`

---

## Bugs históricos — Frontend / Recharts

### Tooltip desincronizado en SalesHistoryChart
- **Síntoma:** Hover sobre `15/02/2026` mostraba datos de `15/02/2024`
- **Causa:** `dataKey="label"` (string `"15/02"`) — colisión entre mismas fechas de distintos años
- **Solución:** `dataKey="day"` (número YYYYMMDD, único por definición)

### Eje X ilegible con rangos largos
- **Síntoma:** 470+ días generaban ticks superpuestos ilegibles
- **Solución:** `minTickGap={40}` + `CustomizedAxisTick` con rotación -30° + `margin bottom: 20`

### TopProductsChart — "Otros" dominaba el gráfico (69–70%)
- **Síntoma:** Con 176–296 productos, "Otros" era la categoría dominante
- **Causa:** `topN=7` fijo no escala con distribuciones de cola larga
- **Solución:** Cobertura acumulada: `COBERTURA_OBJETIVO=0.80` y `MAX_SLICES=8`

### Recharts 3 — tipos TypeScript rotos
- **Síntoma:** `TooltipProps<TValue, TName>` no tiene `active`, `payload` ni `label` (Omit en v3)
- **Solución:** Interfaz local `interface TooltipContent { active?: boolean; payload?: Array<{ value: number }>; label?: string }`. No importar `TooltipProps` para custom tooltips.
- **CustomizedAxisTick:** `(...args: any[]) => { const { x, y, payload } = args[0] as {...} }` — patrón oficial de docs Recharts.

### `fetchSalesComparison` crasheaba con TypeError tras error HTTP
- **Síntoma:** ErrorBoundary activado con `TypeError: Cannot read properties of undefined (reading '0')`
- **Causa:** Sin fallback en el fetch → `setData(undefined)` → `data[0]?.total` falla porque `data` en sí es `undefined`. El `?.` protege el encadenamiento, no el objeto raíz.
- **Solución:** `return { data: json.data ?? [], currentHour: json.currentHour ?? 0 }` — fallback defensivo en client.ts.

---

## Bugs históricos — Dark Mode / Contraste

### Labels KPI y ejes ilegibles en dark mode
- **Síntoma:** Feedback QA "letras poco legibles en modo oscuro"
- **Causa:** Variables `--text-label` / `--chart-axis` con ratio 1.5:1. `CustomizedAxisTick` tenía `fill` hardcodeado que ignoraba el tema.
- **Solución:** Variables → `#718096` (ratio 5:1). `CustomizedAxisTick` usa `useTheme()` → `colors.chartAxis`.

### Múltiples elementos con contraste insuficiente (WCAG AA)
- **Síntoma:** Auditoría completa detectó 5 áreas con ratio < 4.5:1
- **Causa:** `bg-card` (~L≈0.011) es más oscuro que `bg-page` — colores calibrados contra bg-page fallan sobre cards. `COLOR_OTROS=#4b5563` daba 2.3:1 en leyenda (fill decorativo reutilizado como color de texto).
- **Solución:** `--text-very-muted` →`#6e8fa8`, `badge-neutral` →`#8399b0`, tooltips/lista usan `--text-mid`, leyenda "Otros" usa `--text-muted`. **Regla:** para 4.5:1 sobre bg-card necesitás L≥0.225.

---

## Bugs históricos — Backend / PostgreSQL

### Parámetro huérfano en query (`$N` sin referencia)
- **Síntoma:** PostgreSQL: "no se pudo determinar el tipo del parámetro $N"
- **Causa:** `params.push(x)` sin que `$N` aparezca en el SQL (ej: push condicional sin condicional en el SQL)
- **Solución:** Solo pushear params que se van a usar. Verificar con `/validate-query` antes de entregar.

### `ANY($N::bigint[])` falla con node-postgres
- **Síntoma:** Error de tipo o comportamiento inesperado con arrays como parámetro
- **Solución:** `IN ($1, $2, $3)` con params planos individuales. Nunca `= ANY($1::type[])`.

---

## Bugs históricos — refDate / Fechas

### `currentHour` siempre retornaba 0
- **Causa:** `refDate.getHours()` — `refDate` llega como `YYYYMMDD` sin componente horario
- **Solución:** `new Date().getHours()` (hora real del servidor, no de refDate)

### Filtros de período ignoraban `refDate`
- **Causa:** `getPreset()` llamaba `new Date()` internamente en vez de usar refDate
- **Solución:** `getPreset(days, refDate)` con `refDate ? parseRef : new Date()`

### `refDate` faltaba en dependency arrays de `useEffect`
- **Causa:** Se agregó al fetch call pero se olvidó en el array de deps → datos stale al cambiar refDate
- **Solución:** `[empkey, ubicod, timeRange.from, timeRange.to, products, refDate]` — siempre incluirlo
