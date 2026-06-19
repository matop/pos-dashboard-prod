# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A full-stack POS (Point of Sale) analytics dashboard. The backend is a NestJS API serving data from PostgreSQL; the frontend is a React + Vite SPA displaying sales charts and KPIs. Each lives in its own subdirectory with separate `package.json` and `tsconfig.json`.

**Both backend and frontend use pnpm.**

## Development Commands

### Backend (`/backend`)
```bash
cd backend
pnpm install
pnpm run dev       # ts-node watch mode (hot reload)
pnpm run build     # tsc → dist/
pnpm start         # node dist/main.js (no watch)
pnpm test          # Jest + Supertest (106 tests)
pnpm run test:watch
```

### Frontend (`/frontend`)
```bash
cd frontend
pnpm install
pnpm run dev        # Vite dev server at localhost:5173
pnpm run build      # tsc -b && vite build → dist/
pnpm run lint       # ESLint (flat config)
pnpm run preview
```

> If `pnpm run build` fails with `ERR_PNPM_IGNORED_BUILDS`: run `pnpm approve-builds --all` first (one-time per machine).

### Production Deploy
```bash
bash deploy.sh     # Builds both, restarts pm2 (pos-backend), reloads Nginx
# Note: deploy.sh line 21 uses npm for frontend — run manually with pnpm instead
```

## Environment Variables

**`/backend/.env`**
```
PORT=3001
NODE_ENV=development
DATABASE_URL=postgresql://user:pass@host:5432/dbname
FRONTEND_URL=localhost:5173        # used for CORS origin
API_SECRET_KEY=<hex string>
PARAMS_SIDECAR_URL=http://localhost:3002
PARAMS_APP_ID=ServidorPOS          # empty string disables sidecar call (safe fallback)
```

**`/frontend/.env`**
```
VITE_API_SECRET_KEY=<same hex string as backend API_SECRET_KEY>
```

`VITE_API_SECRET_KEY` is baked at build time — verify `.env.production` before building for deployment.

The Vite dev server proxies `/api` → `http://localhost:3001`.

## Architecture

### Request Flow
```
Browser URL (?empkey=X&ubicod=Y)
  → App.tsx (parses URL params)
    → Dashboard.tsx (owns all filter state via useFilters hook)
      → api/client.ts (attaches x-api-key header, builds query params)
        → Backend NestJS (Helmet → CORS → ThrottlerModule → ApiKeyGuard → ValidationPipe → Controller)
          → PostgreSQL (TypeORM raw queries via QueryBuilder utility)
```

### Backend Structure

- `src/main.ts` — app bootstrap; nest-winston, Helmet, CORS, ThrottlerModule global, ValidationPipe, shutdown hooks
- `src/app.module.ts` — root module; imports DatabaseModule, BranchesModule, ProductsModule, ChartsModule, ParamsModule
- `src/database/` — TypeORM DataSource (single connection pool, SSL in prod via `DB_SSL=true`)
- `src/common/guards/api-key.guard.ts` — validates `x-api-key` header on all routes
- `src/common/interceptors/chart-cache.interceptor.ts` — in-memory cache (60s TTL) keyed by full URL; applied at controller level
- `src/common/pipes/parse-empkey.pipe.ts` — validates and parses `empkey` query param
- `src/common/utils/query-builder.ts` — `QueryBuilder` class; auto-numbers `$?` placeholders (see PostgreSQL rules below)
- `src/branches/` — `BranchesModule`: controller + service for `GET /api/branches`
- `src/products/` — `ProductsModule`: controller + service for `GET /api/products`
- `src/charts/` — `ChartsModule`: controller + 4 services (SalesHistory, TopProducts, TopCategories, SalesComparison)
- `src/params/` — `ParamsModule`: controller + service for `GET /api/params`; calls GeneXus sidecar on `:3002`, 5 min cache, silent fallback to `'1'`
- `src/health.controller.ts` — `GET /api/health`

**API Endpoints:**
- `GET /api/branches?empkey=X`
- `GET /api/products?empkey=X`
- `GET /api/params?empkey=X`
- `GET /api/charts/sales-history?empkey=X&ubicod=Y&from=YYYYMMDD&to=YYYYMMDD&refDate=YYYYMMDD&products=`
- `GET /api/charts/top-products?empkey=X&ubicod=Y&from=YYYYMMDD&to=YYYYMMDD&products=`
- `GET /api/charts/top-categories?empkey=X&ubicod=Y&from=YYYYMMDD&to=YYYYMMDD`
- `GET /api/charts/sales-comparison?empkey=X&ubicod=Y&refDate=YYYYMMDD&products=`

### Frontend Structure

- `App.tsx` — reads `?empkey` and `?ubicod` URL params; shows error if `empkey` missing
- `Dashboard.tsx` — layout component; delegates all filter state to `useFilters`
- `api/client.ts` — typed fetch helpers; all shared types defined here (`Branch`, `Product`, `SalesHistoryPoint`, `TopCategoryPoint`, etc.)
- `context/ThemeContext.tsx` — `ThemeProvider` + `useTheme` hook; persists to `localStorage`; sets CSS custom properties on toggle
- `hooks/useFilters.ts` — all filter state (`ubicod`, `branchName`, `timeRange`/`timeRangeLabel`, `products`, `filtersOpen`, `refreshKey`); exposes `{ filters, refreshKey, setUbicod, setBranchName, setTimeRange, setProducts, toggleFilters, activeFilterCount, refresh }`
- `hooks/useFetchChartData.ts` — generic data fetching hook; takes `fetchFn`, `deps[]`, `initialData`
- `hooks/useAppParams.ts` — fetches `GET /api/params` once on mount; returns `{ topMode: '1' | '2' }`; silent fallback
- `hooks/useDismissableDropdown.ts` — click-outside handler for dropdowns
- `utils/dateKeys.ts` — date ↔ YYYYMMDD integer key conversions
- `utils/format.ts` — number/currency formatting helpers
- `components/charts/` — Recharts wrappers; receive theme colors from `useTheme`
  - `TopProductsChart` and `SalesComparisonChart` accept `refreshKey: number` in deps (not as `key=`)
  - `TopCategoriesChart` — shown when `topMode === '2'`; no `products` prop
- `components/filters/` — controlled inputs calling Dashboard state setters
  - `ProductFilter` accepts `disabled?: boolean` (disabled in `topMode === '2'`)
- `components/KPICards.tsx` — KPI summary cards
- `components/ErrorBoundary.tsx` — catches render errors

### Styling System

- Tailwind CSS with a custom ocean color palette (`ocean-base`, `ocean-surface`), ink text colors, and glow accent colors
- Theme switching via CSS custom properties (`--bg-page`, `--text-bright`, `--border-card`, etc.) set on `document.documentElement`
- Custom Google Fonts: **Fraunces** (display headings), **DM Sans** (body), **DM Mono** (monospace)
- Reusable class definitions (`.card`, `.kpi-card`, `.filter-pill`) live in `index.css`

### Key Patterns

- **No React Router** — single page; branch navigation is purely filter state
- **No global state library** — React `useState` via `useFilters`; `ThemeContext` for theme only
- **empkey scoping** — every backend query filters by `empkey` (enterprise ID) for multi-tenant isolation
- **TypeScript strict mode** — both backend and frontend; `noUnusedLocals` and `noUnusedParameters` enforced in frontend

## Testing

### Backend (`/backend`)
```bash
cd backend
pnpm test           # Jest + Supertest — 106 tests
pnpm run test:watch
```

- Spec files live alongside source: `src/branches/*.spec.ts`, `src/products/*.spec.ts`, `src/charts/*.spec.ts`, `src/params/*.spec.ts`, `src/common/utils/*.spec.ts`
- `ChartCacheInterceptor` must be a real provider in tests (not mocked); use unique `empkey` per test to avoid cache hits
- When adding a provider to `ChartsController`, all 4 spec files in `src/charts/` must be updated
- **ALWAYS run `/test` before delivering backend changes**

## PostgreSQL Query Rules (CRITICAL)

All backend services use `QueryBuilder` (`src/common/utils/query-builder.ts`) for parameterized queries:

```typescript
const qb = new QueryBuilder(empkey);           // seeds $1 = empkey
qb.addIf(!!ubicod, 'r.ubicod = $?', ubicod);  // $? → auto-numbered $N
qb.addIn('r.productId', productIds);           // expands to IN ($2, $3, ...)
const { where, params } = qb.build();
```

Rules still enforced even with `QueryBuilder`:
1. **No orphan params** — every pushed value must have a corresponding `$N`.
2. **No `ANY($N::type[])`** — use `addIn()` which generates individual `$N` params.
3. **Conditional params** — use `addIf()` instead of pushing conditionally by hand.
4. **Run `/validate-query`** after modifying any service file.

## Skills & Quality Workflow

### Custom Commands (`.claude/commands/`)
- `/test` — run backend tests before delivering code
- `/validate-query` — check pg queries for orphan params, array casts, SQL injection
- `/deploy-check` — full pre-deploy checklist (tests + tsc + lint + build)
- `/update-doc` — update `ESTADO-DEPLOY-SESIONES-FUTURAS.md` with session changes
- `/review-changes` — comprehensive review pipeline using all relevant skills
- `/smart-delegate` — token optimizer; plan delegation before multi-step tasks (haiku→reads, sonnet→planning/design, opus→code/debug)

### When to invoke installed skills
- **`frontend-design`** — when creating or modifying UI components in `components/charts/` or `components/filters/`. This project uses an **ocean theme** with custom Tailwind palette, CSS custom properties for dark/light, Fraunces + DM Sans fonts.
- **`web-design-guidelines`** — when modifying CSS in `index.css` or any component with user interaction. Check: `:focus-visible` (not `:focus`), `touch-action: manipulation`, `aria-label`, `prefers-reduced-motion`.
- **`vercel-react-best-practices`** — when modifying Dashboard.tsx, chart components, or data fetching logic. Check: `useMemo`/`useCallback` usage, unnecessary re-renders, fetch waterfalls.
- **`context7`** (MCP) — when using external libraries (typeorm, nestjs, recharts, react-datepicker). ALWAYS verify API usage against current docs before implementing.

<!-- autoskills:start -->

Summary generated by `autoskills`. Check the full files inside `.claude/skills`.

## Accessibility (a11y)

Audit and improve web accessibility following WCAG 2.2 guidelines. Use when asked to "improve accessibility", "a11y audit", "WCAG compliance", "screen reader support", "keyboard navigation", or "make accessible".

- `.claude/skills/accessibility/SKILL.md`
- `.claude/skills/accessibility/references/A11Y-PATTERNS.md`: Practical, copy-paste-ready patterns for common accessibility requirements. Each pattern is self-contained and linked from the main [SKILL.md](../SKILL.md).
- `.claude/skills/accessibility/references/WCAG.md`

## Design Thinking

Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, artifacts, posters, or applications (examples include websites, landing pages, dashboards, React components, HTML/CSS layouts, or when styling/beaut...

- `.claude/skills/frontend-design/SKILL.md`

## SEO optimization

Optimize for search engine visibility and ranking. Use when asked to "improve SEO", "optimize for search", "fix meta tags", "add structured data", "sitemap optimization", or "search engine optimization".

- `.claude/skills/seo/SKILL.md`

<!-- autoskills:end -->
