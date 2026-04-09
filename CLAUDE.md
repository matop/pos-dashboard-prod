# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A full-stack POS (Point of Sale) analytics dashboard. The backend is an Express.js API serving data from PostgreSQL; the frontend is a React + Vite SPA displaying sales charts and KPIs. Each lives in its own subdirectory with separate `package.json` and `tsconfig.json`.

## Development Commands

### Backend (`/backend`)
```bash
cd backend
npm install
npm run dev        # tsx watch mode (hot reload)
npm run build      # tsc → dist/
npm start          # tsx src/index.ts (no watch)
```

### Frontend (`/frontend`)
```bash
cd frontend
npm install
npm run dev        # Vite dev server at localhost:5173
npm run build      # tsc -b && vite build → dist/
npm run lint       # ESLint (flat config)
npm run preview    # Preview production build
```

### Production Deploy
```bash
bash deploy.sh     # Builds both, restarts pm2 (pos-backend), reloads Nginx
```

## Environment Variables

**`/backend/.env`**
```
PORT=3001
NODE_ENV=development
DATABASE_URL=postgresql://user:pass@host:5432/dbname
FRONTEND_URL=localhost:5173        # used for CORS origin
API_SECRET_KEY=<hex string>
```

**`/frontend/.env`**
```
VITE_API_SECRET_KEY=<same hex string as backend API_SECRET_KEY>
```

The Vite dev server proxies `/api` → `http://localhost:3001`, so no CORS issues during local development.

## Architecture

### Request Flow
```
Browser URL (?empkey=X&ubicod=Y)
  → App.tsx (parses URL params)
    → Dashboard.tsx (owns all filter state)
      → api/client.ts (attaches x-api-key header, builds query params)
        → Backend Express (Helmet → CORS → Rate Limit → Auth → Validate → Route)
          → PostgreSQL (parameterized queries)
```

### Backend Structure

- `src/index.ts` — app bootstrap, middleware stack, route mounting
- `src/db.ts` — single `pg.Pool` instance (max 20 conns, SSL in prod)
- `src/middleware/auth.ts` — validates `x-api-key` header against `API_SECRET_KEY`
- `src/middleware/validate.ts` — validates `empkey`, date format (YYYYMMDD), product key lists
- `src/routes/` — one file per endpoint; all query `empkey` to scope data per enterprise

**API Endpoints:**
- `GET /api/branches?empkey=X`
- `GET /api/products?empkey=X`
- `GET /api/charts/sales-history?empkey=X&ubicod=Y&startDate=&endDate=&products=`
- `GET /api/charts/top-products?empkey=X&ubicod=Y&startDate=&endDate=`
- `GET /api/charts/sales-comparison?empkey=X&ubicod=Y&startDate=&endDate=`

### Frontend Structure

- `App.tsx` — reads `?empkey` and `?ubicod` URL params; shows error if `empkey` missing
- `Dashboard.tsx` — central state hub (`ubicod`, `timeRange`, `products`, `filtersOpen`, `now`)
- `api/client.ts` — typed fetch helpers; all types (`Branch`, `Product`, `SalesHistoryPoint`, etc.) defined here
- `context/ThemeContext.tsx` — `ThemeProvider` + `useTheme` hook; persists to `localStorage`; updates CSS custom properties on toggle
- `components/charts/` — Recharts wrappers; receive theme colors from `useTheme`
- `components/filters/` — controlled inputs that call Dashboard state setters

### Styling System

- Tailwind CSS with a custom ocean color palette (`ocean-base`, `ocean-surface`), ink text colors, and glow accent colors
- Theme switching via CSS custom properties (`--bg-page`, `--text-bright`, `--border-card`, etc.) set on `document.documentElement`
- Custom Google Fonts: **Fraunces** (display headings), **DM Sans** (body), **DM Mono** (monospace)
- Reusable class definitions (`.card`, `.kpi-card`, `.filter-pill`) live in `index.css`

### Key Patterns

- **No React Router** — a single page; branch navigation is purely filter state
- **No global state library** — React `useState` in Dashboard; `ThemeContext` for theme only
- **empkey scoping** — every backend query filters by `empkey` (enterprise ID) for multi-tenant isolation
- **TypeScript strict mode** — both backend and frontend; `noUnusedLocals` and `noUnusedParameters` enforced in frontend
