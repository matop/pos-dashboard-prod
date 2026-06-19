# Playbook — Configuración PostgreSQL para Producción
> Escenario: Node.js (app server) → PostgreSQL (DB server) · Servidores separados · IPs públicas
> Última actualización: 21 Abril 2026 — validado en prueba QA→prod

---

## Contexto

| | App Server | DB Server |
|---|---|---|
| **Rol** | Express + PM2 + Nginx | PostgreSQL |
| **IP** | `<IP-APP>` ← completar | `<IP-DB>` ← completar |
| **OS** | Debian 12 | Debian 12 |
| **Puerto clave** | 3001 (Node.js) | 5432 (Postgres) |

> ⚠️ Ambos servidores tienen IPs públicas → el tráfico cruza internet → SSL es obligatorio.

---

## Orden de ejecución

```
PASO 1: Servidor DB  — Habilitar SSL en PostgreSQL
PASO 2: Servidor DB  — Copiar cert al app server
PASO 3: Servidor DB  — pg_hba.conf + usuario dedicado
PASO 4: Servidor DB  — Firewall
PASO 5: App server   — Variables de entorno
PASO 6: App server   — Prueba de conexión
PASO 7: App server   — Deploy y smoke test
```

---

## PASO 1 — Habilitar SSL en PostgreSQL (Servidor DB)

```bash
# Verificar versión de Postgres
psql --version
# Anotar el número de versión (ej: 15)

# Verificar si SSL ya está habilitado
grep "^ssl" /etc/postgresql/*/main/postgresql.conf
# Si dice: ssl = on  → saltar al PASO 2
# Si dice: ssl = off o no aparece → continuar

# Habilitar SSL
nano /etc/postgresql/15/main/postgresql.conf
# Cambiar o agregar:
#   ssl = on
```

El paquete `postgresql` en Debian genera `server.crt` y `server.key` automáticamente al habilitar SSL. Verificar que existan:

```bash
ls -la /etc/postgresql/15/main/server.crt
ls -la /etc/postgresql/15/main/server.key
# Si no existen, generarlos manualmente:
openssl req -new -x509 -days 3650 -nodes \
  -out /etc/postgresql/15/main/server.crt \
  -keyout /etc/postgresql/15/main/server.key \
  -subj "/CN=postgres-prod"
chown postgres:postgres /etc/postgresql/15/main/server.crt
chown postgres:postgres /etc/postgresql/15/main/server.key
chmod 600 /etc/postgresql/15/main/server.key
chmod 644 /etc/postgresql/15/main/server.crt
```

Recargar Postgres:

```bash
# IMPORTANTE: listen_addresses requiere RESTART completo (no solo reload)
pg_ctlcluster 15 main restart

# Verificar que escucha en la red (no solo localhost)
ss -tlnp | grep 5432
# Esperado: 0.0.0.0:5432  (si ves solo 127.0.0.1:5432 → restart no aplicó)

systemctl status postgresql
```

> ⚠️ `pg_ctlcluster reload` aplica cambios de `pg_hba.conf` pero **NO** de `listen_addresses`. Para ese parámetro siempre usar `restart`.

---

## PASO 2 — Copiar el certificado al App Server (Servidor DB → App Server)

El app server necesita el cert del servidor DB para verificar la identidad de Postgres.

```bash
# Desde el servidor DB, copiar el cert al app server:
scp /etc/postgresql/15/main/server.crt root@<IP-APP>:/etc/pos-dashboard/pg-server.crt

# En el app server, ajustar permisos:
mkdir -p /etc/pos-dashboard
chmod 755 /etc/pos-dashboard
chown dashboardapp:dashboardapp /etc/pos-dashboard/pg-server.crt
chmod 644 /etc/pos-dashboard/pg-server.crt
```

> Si no tenés acceso SCP directo, copiar el contenido del cert manualmente (es texto plano `-----BEGIN CERTIFICATE-----...`).

---

## PASO 3 — pg_hba.conf y usuario dedicado (Servidor DB)

### 3a. Crear usuario dedicado para el dashboard

```sql
-- Conectar como postgres
sudo -u postgres psql

-- Crear usuario con mínimos privilegios
CREATE USER pos_app_user WITH PASSWORD '<contraseña-fuerte>' NOCREATEDB NOCREATEROLE;

-- Acceso a la base de datos
GRANT CONNECT ON DATABASE pos TO pos_app_user;

-- Solo SELECT (el dashboard es read-only)
\c pos
GRANT USAGE ON SCHEMA pos2407 TO pos_app_user;
GRANT SELECT ON ALL TABLES IN SCHEMA pos2407 TO pos_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA pos2407 GRANT SELECT TO pos_app_user;

-- Verificar
\du pos_app_user
```

### 3b. pg_hba.conf — agregar línea para el usuario del dashboard

```bash
nano /etc/postgresql/15/main/pg_hba.conf
```

Agregar ANTES del bloque `host all all 0.0.0.0/0` (si existe):

```
# POS Dashboard — solo desde el app server, SSL obligatorio
hostssl   pos   pos_app_user   <IP-APP>/32   scram-sha-256
```

> **`hostssl`** = rechaza la conexión si llega sin SSL. Diferente a `host` que acepta con o sin SSL.
> **No tocar** las líneas existentes de los usuarios de Tomcat — solo agregar la nueva.

Verificar la configuración válida y recargar:

```bash
pg_ctlcluster 15 main reload
# o: sudo -u postgres pg_ctl reload -D /etc/postgresql/15/main
```

---

## PASO 4 — Firewall en el Servidor DB

```bash
# Verificar estado actual
ufw status numbered

# Permitir solo desde el app server
ufw allow from <IP-APP> to any port 5432 comment "POS Dashboard app server"

# Denegar todo lo demás en el 5432 (si no hay regla deny ya)
ufw deny 5432

ufw reload

# Verificar
ufw status | grep 5432
```

> ⚠️ Asegurarse de que las conexiones existentes de Tomcat (si Tomcat está en el mismo servidor que Postgres) usan socket Unix o `localhost` — esas no pasan por el firewall de TCP.

---

## PASO 5 — Variables de entorno en App Server

Editar `/var/www/pos-dashboard/backend/.env`:

```env
PORT=3001
NODE_ENV=production
DATABASE_URL=postgresql://pos_app_user:<contraseña>@<IP-DB>:5432/pos
FRONTEND_URL=https://<dominio-prod>
API_SECRET_KEY=<hex-key>
DB_SSL_CA=/etc/pos-dashboard/pg-server.crt
```

> **`DB_SSL_CA`** es la nueva variable. Cuando está configurada, `db.ts` usa `rejectUnauthorized: true` con el cert del servidor Postgres → autenticación completa, sin riesgo de MITM.

Permisos del `.env`:

```bash
chown dashboardapp:dashboardapp /var/www/pos-dashboard/backend/.env
chmod 600 /var/www/pos-dashboard/backend/.env
```

---

## PASO 6 — Prueba de conexión antes de levantar la app

### Desde el app server — con psql

```bash
# Instalar solo el cliente si no está
apt install -y postgresql-client

# Probar conexión con SSL
# IMPORTANTE: usar comillas simples si la contraseña contiene ! (bash interpreta ! como historial)
PGSSLMODE=verify-ca \
PGSSLROOTCERT=/etc/pos-dashboard/pg-server.crt \
psql 'postgresql://pos_app_user:<contraseña>@<IP-DB>:5432/pos' \
  -c "SELECT current_user, ssl_is_used();"
```

Resultado esperado:
```
 current_user  | ssl_is_used
---------------+------------
 pos_app_user  | t
(1 row)
```

### Desde el app server — verificar que sin SSL es rechazado

```bash
PGSSLMODE=disable \
psql "postgresql://pos_app_user:<contraseña>@<IP-DB>:5432/pos" \
  -c "SELECT 1;"
# Esperado: "no pg_hba.conf entry for host..." o "SSL off" rechazado
```

---

## PASO 7 — Deploy y smoke test

```bash
# Levantar backend tomando el nuevo .env
sudo -u dashboardapp HOME=/home/dashboardapp \
  pm2 restart pos-backend --update-env

# Verificar que levantó sin errores de SSL
sudo -u dashboardapp HOME=/home/dashboardapp pm2 logs pos-backend --lines 20

# Smoke test del health endpoint
curl http://localhost:3001/api/health \
  -H "x-api-key: $(grep API_SECRET_KEY /var/www/pos-dashboard/backend/.env | cut -d'=' -f2)"
```

Respuesta esperada:
```json
{
  "status": "ok",
  "db": { "total": 2, "idle": 2, "waiting": 0 },
  "uptime": 5
}
```

```bash
# Smoke test completo — endpoint de datos reales
curl "http://localhost:3001/api/branches?empkey=<empkey>" \
  -H "x-api-key: $(grep API_SECRET_KEY /var/www/pos-dashboard/backend/.env | cut -d'=' -f2)"
# Esperado: JSON con array de sucursales
```

---

## Troubleshooting

| Síntoma | Causa probable | Fix |
|---|---|---|
| `server.crt` no existe en `/etc/postgresql/*/main/` | SSL nunca fue habilitado | Ver PASO 1 — generarlo con openssl |
| `FATAL: no pg_hba.conf entry for host` | IP del app server no está en pg_hba | Verificar IP correcta en PASO 3b |
| `SSL connection is required` al conectar sin SSL | `hostssl` funcionando correctamente | Esperado — conectar con SSL |
| `certificate verify failed` | Cert mal copiado o ruta incorrecta | Re-copiar server.crt, verificar `DB_SSL_CA` en .env |
| `connection timeout` al puerto 5432 | Firewall bloqueando | Verificar IP en regla ufw, `ufw status` |
| `Conexión rehusada` en puerto 5432 | `listen_addresses` aún en `localhost` | Verificar con `ss -tlnp \| grep 5432`, luego `restart` (no reload) |
| `-bash: !@host: event not found` | `!` en contraseña con comillas dobles en bash | Usar comillas **simples** en la URL de conexión |
| `pool.on('error')` en logs con `ECONNREFUSED` | Postgres no escucha en esa IP | Verificar `listen_addresses` en postgresql.conf |
| `ssl = on` en postgresql.conf pero `ssl_is_used() = f` | pg_hba usa `host` no `hostssl` | Cambiar a `hostssl` y recargar |

---

## Cleanup post-prueba (si se usó un DB server temporal para validar conectividad)

Si usaste un servidor QA como DB destino para probar antes de tener prod, revertí los cambios:

```bash
# En el DB server temporal — revertir listen_addresses
nano /etc/postgresql/<version>/main/postgresql.conf
# listen_addresses = 'localhost'

# Quitar la línea hostssl/host que agregaste para el app server
nano /etc/postgresql/<version>/main/pg_hba.conf

# Aplicar (restart por listen_addresses)
pg_ctlcluster <version> main restart

# Quitar regla de firewall (si ufw activo)
ufw delete allow from <IP-APP> to any port 5432
ufw reload
```

> Verificar: `ss -tlnp | grep 5432` debe mostrar solo `127.0.0.1:5432` nuevamente.

---

## Verificación final

```bash
# En el servidor DB — confirmar scram-sha-256
sudo -u postgres psql -c "SHOW password_encryption;"
# → scram-sha-256

# En el servidor DB — ver conexiones activas del app
sudo -u postgres psql -c "
  SELECT application_name, ssl, client_addr, state
  FROM pg_stat_activity
  WHERE usename = 'pos_app_user';"
# → ssl = t para todas las conexiones del dashboard

# En el app server — health endpoint con pool metrics
curl -s http://localhost:3001/api/health \
  -H "x-api-key: <key>" | python3 -m json.tool
```

---

## Resumen de archivos modificados

| Servidor | Archivo | Cambio |
|---|---|---|
| DB | `/etc/postgresql/15/main/postgresql.conf` | `ssl = on` |
| DB | `/etc/postgresql/15/main/pg_hba.conf` | Línea `hostssl` para `pos_app_user` |
| DB | `/etc/postgresql/15/main/server.crt` | Generado automáticamente (o con openssl) |
| App | `/etc/pos-dashboard/pg-server.crt` | Copia del cert del DB server |
| App | `/var/www/pos-dashboard/backend/.env` | `DB_SSL_CA=` + `DATABASE_URL` con usuario dedicado |
| App | `backend/src/db.ts` | `buildSslConfig()` — usa CA cert si `DB_SSL_CA` configurado |
| App | `backend/src/index.ts` | Graceful shutdown + `/api/health` endpoint |
