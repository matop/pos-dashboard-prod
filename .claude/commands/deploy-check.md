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

## Reminder for QA Deploy

After all checks pass, remind the user:
```
# En servidor QA (10.50.10.5):
bash /var/www/pos-dashboard/deploy-servidor-nuevo.sh

# O si se buildea en el servidor:
cd /var/www/pos-dashboard/frontend && npm install && npm run build
sudo -u dashboardapp HOME=/home/dashboardapp pm2 restart pos-backend --update-env
sudo nginx -t && sudo systemctl reload nginx
```
