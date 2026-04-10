#!/usr/bin/env bash
# deploy.sh — Build local + transfer a QA + permisos + restart servicios
set -euo pipefail

# ── Configuración ────────────────────────────────────────────────────
QA_HOST="10.50.10.5"
QA_USER="root"
QA_DEST="/var/www/pos-dashboard"
APP_USER="dashboardapp"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Colores ──────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[deploy]${NC} $*"; }
warn()  { echo -e "${YELLOW}[warn]${NC}   $*"; }
error() { echo -e "${RED}[error]${NC}  $*"; exit 1; }

# ── 1. Build frontend ────────────────────────────────────────────────
info "Building frontend..."
cd "$SCRIPT_DIR/frontend"
npm run build || error "Frontend build failed"

# ── 2. Build backend ─────────────────────────────────────────────────
info "Building backend..."
cd "$SCRIPT_DIR/backend"
npm run build || error "Backend build failed"

# ── 3. Transferir frontend/dist/ ─────────────────────────────────────
info "Uploading frontend/dist/ → $QA_HOST:$QA_DEST/frontend/dist/"
rsync -az --delete \
  "$SCRIPT_DIR/frontend/dist/" \
  "$QA_USER@$QA_HOST:$QA_DEST/frontend/dist/"

# ── 4. Transferir backend/dist/ ──────────────────────────────────────
info "Uploading backend/dist/ → $QA_HOST:$QA_DEST/backend/dist/"
rsync -az --delete \
  "$SCRIPT_DIR/backend/dist/" \
  "$QA_USER@$QA_HOST:$QA_DEST/backend/dist/"

# ── 5. Permisos + restart en servidor QA ─────────────────────────────
info "Fixing permissions and restarting services on QA..."
ssh "$QA_USER@$QA_HOST" bash <<REMOTE
set -e
APP_USER="$APP_USER"
DEST="$QA_DEST"

echo "[remote] Fixing ownership..."
chown -R \$APP_USER:\$APP_USER "\$DEST/frontend/dist"
chown -R \$APP_USER:\$APP_USER "\$DEST/backend/dist"

echo "[remote] Fixing permissions (755 dirs / 644 files)..."
find "\$DEST/frontend/dist" -type d -exec chmod 755 {} \;
find "\$DEST/frontend/dist" -type f -exec chmod 644 {} \;
find "\$DEST/backend/dist"  -type d -exec chmod 755 {} \;
find "\$DEST/backend/dist"  -type f -exec chmod 644 {} \;

echo "[remote] Restarting pm2 (pos-backend)..."
sudo -u \$APP_USER HOME=/home/\$APP_USER pm2 restart pos-backend

echo "[remote] Reloading Nginx..."
nginx -t && systemctl reload nginx

echo "[remote] Services restarted OK"
REMOTE

# ── 6. Health check ──────────────────────────────────────────────────
info "Health check..."
API_KEY=$(ssh "$QA_USER@$QA_HOST" \
  "grep API_SECRET_KEY $QA_DEST/backend/.env | cut -d'=' -f2")

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  "http://$QA_HOST/POSdashboard2603/api/branches?empkey=1136" \
  -H "x-api-key: $API_KEY")

if [ "$HTTP_CODE" = "200" ]; then
  info "API /branches → $HTTP_CODE ✓"
else
  warn "API /branches → $HTTP_CODE  (revisar: pm2 logs pos-backend)"
fi

info "Deploy completo → http://$QA_HOST/POSdashboard2603/?empkey=1136"
