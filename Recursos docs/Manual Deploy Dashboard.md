# Manual de Deploy — POS Dashboard
> Referencia paso a paso para deploy en servidor nuevo (físico o VM).
> Complementa ESTADO-DEPLOY-SESIONES-FUTURAS.md (fuente de verdad del proyecto).

---

## Prerequisitos

| Qué | Dónde | Notas |
|-----|-------|-------|
| Node.js v22+ | Servidor destino | Instalar via NodeSource |
| Nginx | Servidor destino | `apt install nginx` |
| PM2 | Servidor destino | `npm install -g pm2` |
| Usuario `dashboardapp` | Servidor destino | Con sudo, home en `/home/dashboardapp` |
| Acceso SSH + WinSCP | VM dev → servidor | Para transferir archivos |
| `API_SECRET_KEY` del backend destino | Local | Debe coincidir con `VITE_API_SECRET_KEY` del build |

---

## Paso 1 — Build local (VM dev)

### 1a. Verificar la API key del build del frontend

El `VITE_API_SECRET_KEY` se bake en el bundle en tiempo de build — no en runtime.
**Debe coincidir exactamente con el `API_SECRET_KEY` del backend destino.**

```bash
# Verificar qué key tiene frontend/.env.production
cat frontend/.env.production
# Debe ser: VITE_API_SECRET_KEY=<key del servidor destino>
```

Si no existe `frontend/.env.production`, crearlo:
```bash
# En Windows (PowerShell)
echo "VITE_API_SECRET_KEY=<key>" > frontend/.env.production
```

### 1b. Build del backend

```bash
cd backend
npm run build
# Resultado: backend/dist/ con index.js, db.js, logger.js, middleware/, routes/, utils/
```

> `tsconfig.json` ya excluye `*.test.ts` y `src/test/**/*` del build de producción.

### 1c. Build del frontend

```bash
cd frontend
npm run build
# Vite usa .env.production en modo build
# Resultado: frontend/dist/ con index.html y assets/
```

Verificar que `vite.config.ts` tiene `base: '/POSdashboard2603/'` antes de buildear.

---

## Paso 2 — Transferencia de archivos (WinSCP)

Conectar a servidor destino con el usuario `dashboardapp`.

| Origen (local) | Destino (servidor) |
|---|---|
| `backend/dist/` | `/var/www/pos-dashboard/backend/dist/` |
| `backend/package.json` | `/var/www/pos-dashboard/backend/package.json` |
| `backend/package-lock.json` | `/var/www/pos-dashboard/backend/package-lock.json` |
| `frontend/dist/` | `/var/www/pos-dashboard/frontend/dist/` |

> ⚠️ `package.json` y `package-lock.json` son necesarios para `npm install --omit=dev`.
> Nunca subir `node_modules/`, `.env`, ni código fuente.

---

## Paso 3 — Permisos post-WinSCP (SSH en servidor)

WinSCP sube archivos con el usuario SSH del operador, no con `dashboardapp`.
Siempre corregir después de cada transferencia:

```bash
sudo chown -R dashboardapp:dashboardapp /var/www/pos-dashboard/

sudo find /var/www/pos-dashboard/backend/dist/ -type d -exec chmod 755 {} \;
sudo find /var/www/pos-dashboard/backend/dist/ -type f -exec chmod 644 {} \;

sudo find /var/www/pos-dashboard/frontend/dist/ -type d -exec chmod 755 {} \;
sudo find /var/www/pos-dashboard/frontend/dist/ -type f -exec chmod 644 {} \;
```

Verificar que llegaron:
```bash
ls /var/www/pos-dashboard/backend/dist/
ls /var/www/pos-dashboard/frontend/dist/
```

---

## Paso 4 — Configuración del backend

### 4a. Crear el .env de producción

```bash
nano /var/www/pos-dashboard/backend/.env
```

Contenido (ajustar según entorno):
```env
PORT=3001
NODE_ENV=production
DATABASE_URL=postgresql://usuario:password@host:5432/dbname
FRONTEND_URL=http://<IP o dominio del servidor>
API_SECRET_KEY=<hex string — debe coincidir con VITE_API_SECRET_KEY del build>
```

```bash
chmod 600 /var/www/pos-dashboard/backend/.env
```

> Si la DB es remota y se accede por túnel SSH, `DATABASE_URL` apunta a `localhost:5432`
> y el túnel redirige ese puerto al servidor de base de datos real.

### 4b. Instalar dependencias de producción

```bash
cd /var/www/pos-dashboard/backend
sudo -u dashboardapp HOME=/home/dashboardapp npm install --omit=dev
```

---

## Paso 5 — Túnel SSH a la base de datos (si DB es remota)

Si el backend no tiene PostgreSQL local y se conecta a otro servidor por túnel:

```bash
# Probar el túnel manualmente (en foreground para verificar):
ssh -L 5432:localhost:5432 usuario@<IP-servidor-DB> -N

# Para que corra en background de forma persistente, usar autossh:
sudo apt install -y autossh

# Crear el túnel como dashboardapp (en background):
sudo -u dashboardapp autossh -M 0 -f -N \
  -o "ServerAliveInterval=30" \
  -o "ServerAliveCountMax=3" \
  -L 5432:localhost:5432 usuario@<IP-servidor-DB>
```

Para que el túnel sobreviva reinicios, ver Paso 8 (systemd service).

---

## Paso 6 — Iniciar backend con PM2

```bash
# Primera vez:
sudo -u dashboardapp HOME=/home/dashboardapp pm2 start \
  /var/www/pos-dashboard/backend/dist/index.js \
  --name pos-backend

# Verificar que arrancó:
sudo -u dashboardapp HOME=/home/dashboardapp pm2 status
sudo -u dashboardapp HOME=/home/dashboardapp pm2 logs pos-backend --lines 20

# Si hubo cambios en .env después de arrancar:
sudo -u dashboardapp HOME=/home/dashboardapp pm2 restart pos-backend --update-env
```

---

## Paso 7 — Configurar Nginx

### 7a. Crear la config

```bash
sudo nano /etc/nginx/sites-available/pos-dashboard
```

Contenido:
```nginx
server {
    listen 80;
    server_name <IP-del-servidor> localhost;

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

### 7b. Activar y recargar

```bash
sudo ln -s /etc/nginx/sites-available/pos-dashboard /etc/nginx/sites-enabled/pos-dashboard
sudo nginx -t
sudo systemctl reload nginx
```

> Si hay un `default` server con `listen 80 default_server`, asegurarse de que
> `pos-dashboard` NO tenga `default_server` para evitar duplicados.

---

## Paso 8 — PM2 startup (persistencia tras reboot)

```bash
# ⚠️ Orden de argumentos CRÍTICO: -u <usuario> antes de --hp
sudo env PATH=$PATH:/usr/bin \
  sudo -u dashboardapp HOME=/home/dashboardapp \
  pm2 startup systemd -u dashboardapp --hp /home/dashboardapp

# Copiar y ejecutar el comando que PM2 imprime en pantalla

# Guardar el proceso actual:
sudo -u dashboardapp HOME=/home/dashboardapp pm2 save
```

Verificar:
```bash
systemctl status pm2-dashboardapp
# "inactive (dead)" es NORMAL si PM2 ya estaba corriendo —
# el servicio solo actúa en boot con pm2 resurrect.
```

---

## Paso 9 — Smoke tests

```bash
# Frontend sirve index.html:
curl -I http://localhost/POSdashboard2603/

# Backend responde (sin auth → 401 esperado):
curl http://localhost/POSdashboard2603/api/branches?empkey=1136

# Backend con auth:
curl http://localhost/POSdashboard2603/api/branches?empkey=1136 \
  -H "x-api-key: $(grep API_SECRET_KEY /var/www/pos-dashboard/backend/.env | cut -d'=' -f2)"

# Desde otra máquina (reemplazar IP):
curl http://192.168.56.101/POSdashboard2603/api/branches?empkey=1136 \
  -H "x-api-key: <key>"
```

---

## Redeploy (actualizaciones futuras)

```bash
# 1. Build local (VM dev) — ver Paso 1
# 2. Transferir dist/ via WinSCP — ver Paso 2
# 3. En el servidor:

# Corregir permisos:
sudo chown -R dashboardapp:dashboardapp /var/www/pos-dashboard/frontend/dist/
sudo find /var/www/pos-dashboard/frontend/dist/ -type f -exec chmod 644 {} \;

# Si cambió backend/dist/:
sudo chown -R dashboardapp:dashboardapp /var/www/pos-dashboard/backend/dist/
sudo -u dashboardapp HOME=/home/dashboardapp pm2 restart pos-backend

# Siempre al final:
sudo nginx -t && sudo systemctl reload nginx
```

---

## Referencia rápida de comandos operativos

```bash
# Estado general
sudo -u dashboardapp HOME=/home/dashboardapp pm2 status
sudo systemctl status nginx

# Logs en tiempo real
sudo -u dashboardapp HOME=/home/dashboardapp pm2 logs pos-backend --lines 50

# Reiniciar backend con nuevas variables de entorno
sudo -u dashboardapp HOME=/home/dashboardapp pm2 restart pos-backend --update-env

# Recargar Nginx sin downtime
sudo nginx -t && sudo systemctl reload nginx
```

---

## Trampas conocidas

| Síntoma | Causa | Fix |
|---------|-------|-----|
| 401 en todos los endpoints | `VITE_API_SECRET_KEY` del build ≠ `API_SECRET_KEY` del backend | Actualizar `.env.production`, rebuild, redeploy |
| 404 después de WinSCP | PM2/Nginx no se recargaron | Ver sección Redeploy |
| PM2 startup genera `User=--hp` | Orden de args incorrecto | `-u dashboardapp --hp /home/dashboardapp` (en ese orden) |
| `pm2 restart` ignora cambios en .env | Variables cacheadas del inicio | Usar `--update-env` siempre |
| Frontend build falla en servidor | `npm install --omit=dev` excluye vite/tsc | Usar `npm install` completo para builds |
| Nginx elimina header `x-api-key` | Nginx externo no tiene `proxy_set_header` | Agregar `proxy_set_header x-api-key $http_x_api_key` |
