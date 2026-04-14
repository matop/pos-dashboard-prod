# Playbook — Deploy a Producción
> POS Dashboard · Debian 12 · PostgreSQL local · Nginx externo delante
> Generado: 14 Abril 2026

---

## Datos del entorno de producción

| Variable | Valor |
|----------|-------|
| OS | Debian 12 |
| Tomcat (preexistente) | puerto 8080 — no tocar |
| Nginx interno (nuevo) | puerto 80 |
| Nginx externo | gestionado por compañero |
| PostgreSQL | local, `localhost:5432` |
| Usuario app | `dashboardapp` |
| Ruta app | `/var/www/pos-dashboard/` |
| URL pública | `https://<dominio-prod>/POSdashboard2603/` |
| `API_SECRET_KEY` (prod) | `0c8ed4477e54bac978f5344182486283401ac21c44c6d40ee92d4ded4442bfeb` |

> ⚠️ La key de producción es diferente a la de QA. Nunca mezclarlas.

---

## FASE 0 — Preparar localmente (VM dev)

### 0a. Configurar la key de producción en el frontend

```bash
# En la VM dev, editar frontend/.env.production:
VITE_API_SECRET_KEY=0c8ed4477e54bac978f5344182486283401ac21c44c6d40ee92d4ded4442bfeb
```

### 0b. Build completo

```bash
# Backend
cd backend
npm run build
# Resultado: backend/dist/

# Frontend (usa .env.production automáticamente)
cd ../frontend
npm run build
# Resultado: frontend/dist/
# Verificar que vite.config.ts tiene base: '/POSdashboard2603/'
```

### 0c. Verificar antes de transferir

```bash
cd backend && npm test          # 89 tests deben pasar
cd ../frontend && npm run lint  # sin errores
```

---

## FASE 1 — Setup del servidor (una sola vez)

> Conectarse por SSH al servidor de producción como root o con sudo.

### 1a. Crear usuario dashboardapp

```bash
sudo useradd -m -s /bin/bash dashboardapp
sudo mkdir -p /home/dashboardapp/.pm2/{logs,pids,modules}
sudo chown -R dashboardapp:dashboardapp /home/dashboardapp/
```

### 1b. Instalar Node.js 22

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt install -y nodejs
node --version   # debe mostrar v22.x.x
```

### 1c. Instalar PM2

```bash
sudo npm install -g pm2
pm2 --version
```

### 1d. Instalar Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

> ⚠️ Tomcat corre en 8080. Nginx va en 80. No hay conflicto.
> Verificar: `sudo ss -tlnp | grep -E '80|8080'`

### 1e. Crear estructura de directorios

```bash
sudo mkdir -p /var/www/pos-dashboard/backend/dist
sudo mkdir -p /var/www/pos-dashboard/backend/logs
sudo mkdir -p /var/www/pos-dashboard/frontend/dist
sudo chown -R dashboardapp:dashboardapp /var/www/pos-dashboard/
```

---

## FASE 2 — Transferir archivos (WinSCP)

Conectar a servidor prod con usuario SSH.

| Origen (VM dev) | Destino (servidor prod) |
|----------------|------------------------|
| `backend/dist/` | `/var/www/pos-dashboard/backend/dist/` |
| `backend/package.json` | `/var/www/pos-dashboard/backend/package.json` |
| `backend/package-lock.json` | `/var/www/pos-dashboard/backend/package-lock.json` |
| `frontend/dist/` | `/var/www/pos-dashboard/frontend/dist/` |

> ❌ NO subir: `node_modules/`, `.env`, `src/`

---

## FASE 3 — Configurar el servidor

### 3a. Permisos post-WinSCP

```bash
sudo chown -R dashboardapp:dashboardapp /var/www/pos-dashboard/
sudo find /var/www/pos-dashboard/backend/dist/ -type d -exec chmod 755 {} \;
sudo find /var/www/pos-dashboard/backend/dist/ -type f -exec chmod 644 {} \;
sudo find /var/www/pos-dashboard/frontend/dist/ -type d -exec chmod 755 {} \;
sudo find /var/www/pos-dashboard/frontend/dist/ -type f -exec chmod 644 {} \;
```

### 3b. Crear el .env de producción

```bash
sudo nano /var/www/pos-dashboard/backend/.env
```

Contenido:
```env
PORT=3001
NODE_ENV=production
DATABASE_URL=postgresql://<usuario>:<password>@localhost:5432/<dbname>
FRONTEND_URL=https://<dominio-prod>
API_SECRET_KEY=0c8ed4477e54bac978f5344182486283401ac21c44c6d40ee92d4ded4442bfeb
```

```bash
sudo chown dashboardapp:dashboardapp /var/www/pos-dashboard/backend/.env
sudo chmod 600 /var/www/pos-dashboard/backend/.env
```

### 3c. Instalar dependencias de producción del backend

```bash
cd /var/www/pos-dashboard/backend
sudo -u dashboardapp HOME=/home/dashboardapp npm install --omit=dev
```

### 3d. Configurar Nginx interno

```bash
sudo nano /etc/nginx/sites-available/pos-dashboard
```

Contenido:
```nginx
server {
    listen 80;
    server_name <IP-prod> localhost;

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
}
```

```bash
sudo ln -s /etc/nginx/sites-available/pos-dashboard /etc/nginx/sites-enabled/pos-dashboard
# Desactivar el default si genera conflicto de default_server:
# sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### 3e. Iniciar backend con PM2

```bash
# ⚠️ --cwd es OBLIGATORIO (dotenv busca .env en el cwd, no en el dir del script)
sudo -u dashboardapp HOME=/home/dashboardapp pm2 start \
  /var/www/pos-dashboard/backend/dist/index.js \
  --name pos-backend \
  --cwd /var/www/pos-dashboard/backend

# Verificar que arrancó (status: online)
sudo -u dashboardapp HOME=/home/dashboardapp pm2 status
sudo -u dashboardapp HOME=/home/dashboardapp pm2 logs pos-backend --lines 30
```

### 3f. PM2 startup — persistencia tras reboot

```bash
# ⚠️ Orden de argumentos crítico: -u <usuario> ANTES de --hp
sudo pm2 startup systemd -u dashboardapp --hp /home/dashboardapp
# PM2 imprime un comando — ejecutarlo tal cual

sudo -u dashboardapp HOME=/home/dashboardapp pm2 save

# Verificar (inactive es NORMAL si PM2 ya está corriendo):
systemctl status pm2-dashboardapp
```

---

## FASE 4 — Configuración del Nginx externo

> Esta sección es para el compañero que administra el Nginx externo.

Agregar a la config del dominio de producción:

```nginx
# ⚠️ x-api-key OBLIGATORIO — sin esto todos los requests dan 401
location /POSdashboard2603/api/ {
    proxy_pass         http://<IP-prod>:3001/api/;
    proxy_http_version 1.1;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
    proxy_set_header   x-api-key         $http_x_api_key;
    proxy_connect_timeout 10s;
    proxy_read_timeout    30s;
}

location /POSdashboard2603/ {
    proxy_pass         http://<IP-prod>/POSdashboard2603/;
    proxy_http_version 1.1;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
    proxy_connect_timeout 10s;
    proxy_read_timeout    30s;
}
```

---

## FASE 5 — Smoke tests

```bash
# Desde el servidor prod (interno):
curl -I http://localhost/POSdashboard2603/
# Esperado: HTTP/1.1 200 OK

curl http://localhost/POSdashboard2603/api/branches?empkey=<empkey>
# Esperado: {"error":"No autorizado"} (401) — correcto, prueba que llega al backend

curl http://localhost/POSdashboard2603/api/branches?empkey=<empkey> \
  -H "x-api-key: 0c8ed4477e54bac978f5344182486283401ac21c44c6d40ee92d4ded4442bfeb"
# Esperado: {"branches":[...]} con datos reales

# Desde fuera (una vez que el Nginx externo esté configurado):
curl https://<dominio-prod>/POSdashboard2603/api/branches?empkey=<empkey> \
  -H "x-api-key: 0c8ed4477e54bac978f5344182486283401ac21c44c6d40ee92d4ded4442bfeb"
```

---

## FASE 6 — Redeploy (actualizaciones futuras)

```bash
# 1. Build local (Fase 0)
# 2. Subir dist/ via WinSCP (Fase 2)
# 3. En el servidor:

sudo chown -R dashboardapp:dashboardapp /var/www/pos-dashboard/frontend/dist/
sudo find /var/www/pos-dashboard/frontend/dist/ -type f -exec chmod 644 {} \;

# Solo si cambió el backend:
sudo chown -R dashboardapp:dashboardapp /var/www/pos-dashboard/backend/dist/
sudo -u dashboardapp HOME=/home/dashboardapp pm2 restart pos-backend --update-env

# Siempre:
sudo nginx -t && sudo systemctl reload nginx
```

---

## Comandos de operación diaria

```bash
# Estado
sudo -u dashboardapp HOME=/home/dashboardapp pm2 status
sudo systemctl status nginx

# Logs en tiempo real
sudo -u dashboardapp HOME=/home/dashboardapp pm2 logs pos-backend --lines 50

# Reiniciar backend (ej: si cambió .env)
sudo -u dashboardapp HOME=/home/dashboardapp pm2 restart pos-backend --update-env
```

---

## Trampas conocidas

| Síntoma | Causa | Fix |
|---------|-------|-----|
| 401 en todos los endpoints | Key del build ≠ key del backend | Verificar `.env.production` antes de cada build |
| 401 solo desde el dominio externo | Nginx externo no pasa `x-api-key` | Agregar `proxy_set_header x-api-key $http_x_api_key` |
| PM2 crash "DATABASE_URL no configurada" | Falta `--cwd` en el start | Usar `--cwd /var/www/pos-dashboard/backend` siempre |
| `pm2 restart` ignora cambios en .env | Variables cacheadas | Usar `--update-env` |
| 404 después de WinSCP | PM2/Nginx no recargados | Ver Fase 6 completa |
| PM2 startup genera `User=--hp` | Orden de args incorrecto | `-u dashboardapp` ANTES de `--hp` |
| Nginx default_server duplicado | Dos bloques con `listen 80 default_server` | No agregar `default_server` al bloque pos-dashboard |
