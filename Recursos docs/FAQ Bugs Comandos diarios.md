# FAQ — Bugs, Comandos Diagnóstico y Trampas Comunes
> POS Dashboard — referencia rápida para troubleshooting en el día a día

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
