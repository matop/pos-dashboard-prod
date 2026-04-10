---
description: Pre-deploy checklist for POS Dashboard. Run before deploying to QA server.
---

# Pre-Deploy Checklist

Run through all checks before deploying to QA (10.50.10.5).

## Automated Checks

1. **Backend tests:** `cd backend && npx vitest run`
2. **Backend TypeScript:** `cd backend && npx tsc --noEmit`
3. **Frontend TypeScript:** `cd frontend && npx tsc -b`
4. **Frontend lint:** `cd frontend && npx eslint .`
5. **Frontend build:** `cd frontend && npx vite build`

## Manual Verification Report

After running automated checks, report status for each:

| Check | Status | Notes |
|-------|--------|-------|
| Backend tests | ✅/❌ | N tests passed/failed |
| Backend tsc | ✅/❌ | |
| Frontend tsc | ✅/❌ | |
| Frontend lint | ✅/⚠️/❌ | Warnings count |
| Frontend build | ✅/❌ | Bundle size |

## Reminder for Deploy

After all checks pass, remind the user to pick the target environment:

### QA (10.50.10.5) — vía deploy.sh o rsync
```bash
bash /var/www/pos-dashboard/deploy-servidor-nuevo.sh
# O manual:
sudo -u dashboardapp HOME=/home/dashboardapp pm2 restart pos-backend --update-env
sudo nginx -t && sudo systemctl reload nginx
```

### pos-prod-sim (192.168.56.101) — vía WinSCP + terminal VM
```bash
# 1. Verificar que PuTTY tunnel sigue activo en Windows:
#    netstat -an | findstr "5433"  → debe mostrar 0.0.0.0:5433 LISTENING

# 2. En la VM (como dashboardapp):
pm2 restart pos-backend --update-env
# Si es primer deploy:
pm2 start /var/www/pos-dashboard/backend/dist/index.js \
  --name pos-backend \
  --cwd /var/www/pos-dashboard/backend   # ⚠️ --cwd OBLIGATORIO

# 3. Nginx:
nginx -t && systemctl reload nginx
```

> ⚠️ Verificar siempre que `VITE_API_SECRET_KEY` del build coincide con `API_SECRET_KEY` del servidor destino.
