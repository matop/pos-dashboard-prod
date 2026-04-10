---
description: Diagnose and fix backend issues on POS Dashboard servers (QA or pos-prod-sim). Use when PM2 is errored, API returns 5xx/401, or server is unreachable.
---

# Server Diagnose — POS Dashboard

Guía paso a paso para diagnosticar el backend en cualquier servidor del proyecto.
Seguí los pasos en orden — cada uno descarta una causa.

---

## Paso 1 — Identificar el servidor

Preguntá al usuario en qué servidor está el problema:

| Servidor | IP | Acceso |
|---|---|---|
| QA | 10.50.10.5 | SSH como root |
| pos-prod-sim | 192.168.56.101 | Terminal VM (VirtualBox), login como root o dashboardapp |

---

## Paso 2 — Verificar PM2

**Como dashboardapp** (en pos-prod-sim: `su - dashboardapp`):
```bash
pm2 status
```

| Resultado | Siguiente paso |
|---|---|
| `online` | Ir a Paso 4 (problema de red/Nginx) |
| `errored` o reinicios altos | Ir a Paso 3 (leer logs) |
| Lista vacía | Backend no iniciado → Paso 5 (arrancar) |
| `spawn /usr/bin/node EACCES` | Ejecutar como dashboardapp, NO como `sudo -u dashboardapp` desde root |

---

## Paso 3 — Leer logs del error

```bash
# Como dashboardapp:
pm2 logs pos-backend --lines 30 --nostream
```

### Errores comunes y su causa:

| Error en log | Causa | Fix |
|---|---|---|
| `FATAL: DATABASE_URL no está configurada` | PM2 sin `--cwd` → dotenv no encuentra `.env` | Ver Paso 5 — arrancar con `--cwd` |
| `ECONNREFUSED` o `connect ETIMEDOUT` al puerto DB | Túnel PuTTY caído o DB inaccesible | Ver Paso 6 (túnel) |
| `self-signed certificate` | `rejectUnauthorized: true` en DB SSL | Verificar `db.ts` — debe tener `rejectUnauthorized: false` en QA |
| `Cannot find module` | `dist/` vacío o npm install no corrido | `npm install --omit=dev` en `/var/www/pos-dashboard/backend` |
| `EADDRINUSE :3001` | Puerto ocupado por instancia anterior | `pm2 delete pos-backend` y reiniciar |

---

## Paso 4 — Verificar conectividad API

```bash
# Sin auth → debe responder 401 (confirma que el proceso está vivo):
curl -s http://localhost:3001/api/branches?empkey=1136

# Con auth → debe responder datos:
API_KEY=$(grep API_SECRET_KEY /var/www/pos-dashboard/backend/.env | cut -d'=' -f2)
curl -s "http://localhost:3001/api/branches?empkey=1136" -H "x-api-key: $API_KEY"

# Vía Nginx:
curl -s "http://localhost/POSdashboard2603/api/branches?empkey=1136" -H "x-api-key: $API_KEY"
```

| Resultado | Causa probable |
|---|---|
| `{"branches":[...]}` | ✅ Backend OK |
| `{"error":"No autorizado"}` | API key incorrecta — ver Paso 7 |
| `{"error":"Error interno"}` | DB inaccesible — ver Paso 6 |
| HTML o `curl: (7) Failed to connect` | Nginx mal configurado o backend caído |

---

## Paso 5 — Arrancar el backend correctamente

```bash
# Eliminar proceso con error:
pm2 delete pos-backend

# Arrancar con --cwd OBLIGATORIO (sin esto, dotenv no encuentra .env):
pm2 start /var/www/pos-dashboard/backend/dist/index.js \
  --name pos-backend \
  --cwd /var/www/pos-dashboard/backend

# Verificar que se mantiene online (esperar 5 segundos):
pm2 status
```

> ⚠️ En pos-prod-sim: ejecutar siempre como `dashboardapp`, nunca con `sudo -u dashboardapp` desde root (sudo no está instalado).

---

## Paso 6 — Diagnosticar conexión a la DB

### QA (DB local en el mismo servidor):
```bash
nc -zv localhost 5432 2>&1; echo "exit: $?"
# exit: 0 = OK
```

### pos-prod-sim (DB vía túnel PuTTY desde Windows):
```bash
# Verificar que el túnel llega (desde pos-prod-sim):
nc -zv 192.168.56.1 5433 2>&1; echo "exit: $?"
# exit: 0 = túnel activo
# exit: 1 = PuTTY caído o firewall Windows bloqueando
```

Si el túnel está caído → en Windows:
```powershell
netstat -an | findstr "5433"
# Debe mostrar: TCP  0.0.0.0:5433  LISTENING
# Si no aparece → reconectar sesión PuTTY con tunnel 0.0.0.0:5433 → localhost:5432
```

---

## Paso 7 — Diagnosticar API key (401)

```bash
# Key actual del backend:
grep API_SECRET_KEY /var/www/pos-dashboard/backend/.env

# La key del frontend se bakeó en build time — si no coincide, rebuild es necesario
```

**En QA:** actualizar `frontend/.env.production` con la key correcta → rebuild → redeploy dist/.
**En pos-prod-sim:** igual — verificar que `frontend/.env.production` tenía la key correcta antes del build.

---

## Paso 8 — Verificar Nginx

```bash
nginx -t                    # verificar config
systemctl reload nginx      # recargar sin downtime
curl -I http://localhost/POSdashboard2603/   # debe responder 200
```

---

## Referencia rápida — comandos de emergencia

```bash
# Reiniciar todo (como dashboardapp):
pm2 restart pos-backend --update-env
# Como root:
nginx -t && systemctl reload nginx

# Ver logs en tiempo real:
pm2 logs pos-backend

# Estado general:
pm2 status && systemctl status nginx
```
