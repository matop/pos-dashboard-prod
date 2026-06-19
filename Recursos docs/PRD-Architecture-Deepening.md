# PRD — Architecture Deepening: 5 Independent Refactors

**Status:** ✅ Completo — R1 ✅ R2 ✅ R3 ✅ R4 ✅ R5 ✅
**Approach:** Divide-and-conquer — each item is independently deliverable and testable

---

## Problem Statement

The POS Dashboard codebase has grown to a point where several modules are **shallow** — their interface is nearly as complex as their implementation — or repeat the same pattern across multiple files without abstraction. This creates compounding friction: index-tracking bugs in SQL generation, inconsistent error handling in data fetching, an inconsistent reset behavior on dashboard refresh, and scattered color definitions that don't respond to theme changes. Each friction point is localized enough to fix in isolation, but together they slow down future feature work and make the codebase harder for both humans and AI agents to navigate.

---

## Solution

Five targeted deepening refactors, each producing a module with a **smaller interface than its implementation** (leverage), concentrating related logic in one place (locality), and improving test isolation. Each refactor is self-contained: it can be delivered, reviewed, and merged independently without touching the others.

---

## User Stories

### Refactor 1 — Query Builder (Backend Chart Services) ✅ IMPLEMENTADO (05 Jun 2026)

1. As a backend developer, I want SQL parameter tracking to be handled automatically, so that I never have a mismatch between `params.push()` calls and `$N` references in SQL.
2. As a backend developer, I want to add a conditional filter clause by calling a single method, so that I don't need to manually track array indices across branches.
3. As a backend developer, I want the `IN (...)` placeholder generation for product keys to be encapsulated, so that I don't duplicate the `map((_, i) => $${params.length + i + 1})` pattern.
4. As a backend developer, I want all three chart services to share the same query-building logic, so that a fix to one applies to all.
5. As a backend developer reviewing a chart service, I want to read only business-relevant conditions (not bookkeeping), so that I can understand the query logic at a glance.

### Refactor 2 — `useFetchChartData` Custom Hook (Frontend) ✅ IMPLEMENTADO (05 Jun 2026)

6. As a frontend developer, I want a single custom hook that handles `loading`, `data`, and `error` state for any chart fetch, so that I don't write the same reducer + AbortController + isAbortError pattern three times.
7. As a frontend developer, I want consistent action-type naming across all chart components, so that I don't confuse `'fetch'` vs `'FETCH_START'`.
8. As a frontend developer, I want fetch abort cleanup to be encapsulated in the hook, so that individual chart components don't manage AbortController lifecycle.
9. As a frontend developer adding a fourth chart, I want to use the same hook as the other three, so that I get abort handling and error normalization for free.

### Refactor 3 — `useFilters` Hook + Dashboard Refresh Fix (Frontend) ✅ IMPLEMENTADO (05 Jun 2026)

10. As a frontend developer, I want filter state (`ubicod`, `timeRange`, `products`, `branchName`, `timeRangeLabel`) extracted into a `useFilters` hook, so that Dashboard.tsx can focus on layout and rendering.
11. As a frontend developer, I want the refresh action to reset all three data sources (sales-history + top-products + sales-comparison), so that clicking "refresh" updates the entire dashboard, not just two charts.
12. As a frontend developer, I want filter-related localStorage persistence (filters panel open/closed) to live inside `useFilters`, so that Dashboard.tsx doesn't have direct `localStorage` access.
13. As a developer reading Dashboard.tsx, I want to see filter state as a single destructured object, so that I don't need to count 6 `useState` calls to understand what's configurable.

### Refactor 4 — Centralized Chart Color Palette (Frontend) ✅ IMPLEMENTADO (05 Jun 2026)

14. As a frontend developer, I want all chart series colors (pie palette, bar colors, line colors) to be defined in `ThemeContext`, so that I can change the color scheme in one place.
15. As a UI designer, I want bar and line colors to respond to dark/light mode toggling, so that chart colors are visually coherent with the rest of the UI.
16. As a frontend developer, I want chart components to consume colors from `useTheme()` rather than local constants, so that adding a new theme doesn't require editing each chart file.
17. As a developer reviewing a chart component, I want zero hardcoded color hex strings in the component body, so that I can trust the theme system is the single source of truth.

### Refactor 5 — `useDismissableDropdown` Hook (ProductFilter) ✅ IMPLEMENTADO (05 Jun 2026)

18. As a frontend developer, I want click-outside and scroll-dismiss logic extracted into a single hook, so that ProductFilter.tsx has one responsibility: rendering the dropdown content.
19. As a frontend developer, I want dropdown position to recalculate on window scroll (not just on open), so that the dropdown doesn't drift when the user scrolls after opening.
20. As a frontend developer adding another portal-based dropdown, I want to reuse `useDismissableDropdown`, so that I don't copy-paste three `useEffect` blocks.
21. As a developer reviewing ProductFilter, I want to see the dismiss behavior described at the call site in one line, so that I don't need to trace three separate effects.

---

## Implementation Decisions

### Refactor 1 — Query Builder

- A `QueryBuilder` class (or factory function) is introduced in `src/common/` with three methods:
  - `add(sql: string, value: unknown)` — appends a mandatory condition with one param
  - `addIf(condition: boolean, sql: string, value: unknown)` — conditional single-param clause
  - `addIn(column: string, values: unknown[])` — generates `column IN ($N, $N+1, ...)` automatically
  - `build() → { where: string; params: unknown[] }` — returns final SQL fragment and params array
- Each chart service is refactored to construct a `QueryBuilder`, call its methods, then spread `build()` into the `DataSource.query()` call.
- The `QueryBuilder` interface does NOT expose the internal index counter — callers never see `$N`.
- The existing CLAUDE.md PostgreSQL Query Rules (no `ANY($N)`, no orphan params) are enforced by the builder's implementation, not by caller convention.

### Refactor 2 — `useFetchChartData`

- A custom hook `useFetchChartData<T>(fetchFn, deps)` is added to `src/hooks/` (or `src/utils/`).
- It encapsulates: `useReducer` with canonical action types `FETCH_START | FETCH_SUCCESS | FETCH_ERROR`, `useEffect` with `AbortController`, and `isAbortError` filtering.
- Returns `{ data: T; loading: boolean; error: string | null }`.
- `fetchFn` receives the `AbortSignal` as part of its argument; the hook passes it transparently.
- The three chart components (`TopProductsChart`, `SalesComparisonChart`, and the sales-history fetch in `Dashboard`) are migrated to use this hook.

### Refactor 3 — `useFilters` + Refresh Fix

- `useFilters(empkey, initialUbicod)` hook is extracted. It owns: `ubicod`, `branchName`, `timeRange`, `timeRangeLabel`, `products`, `filtersOpen` (with localStorage sync), and `activeFilterCount`.
- Returns a stable object: `{ filters, setUbicod, setBranchName, setTimeRange, setProducts, toggleFilters, activeFilterCount }`.
- The `refreshKey` mechanism in Dashboard is replaced by a unified `refresh()` function that signals all three data hooks to re-fetch. How this is threaded to each hook is an implementation detail left to the implementer (could be a separate `refreshKey` passed to each hook, or a context signal).
- Dashboard.tsx becomes a layout component that renders filters + charts, delegating state to `useFilters` and data to `useFetchChartData` hooks.

### Refactor 4 — Chart Color Palette

- `ThemeContext` is extended to expose `colors.series: string[]` (pie/bar palette) and `colors.comparison: string[]` (sales-comparison bars).
- `DARK_COLORS` and `LIGHT_COLORS` objects in `ThemeContext` are extended with these arrays.
- Each chart component removes its local `PALETTE`, `BAR_COLORS`, and hardcoded hex strings, consuming colors via `const { colors } = useTheme()` instead.
- Existing `colors.chartAxis`, `colors.tooltipBg`, etc. are preserved; this refactor only adds `series` and `comparison` keys.

### Refactor 5 — `useDismissableDropdown`

- A `useDismissableDropdown(buttonRef, dropdownRef)` hook is extracted to `src/hooks/`.
- It encapsulates: click-outside detection, scroll-dismiss detection, and position recalculation on scroll while open.
- Returns `{ isOpen, open, close, toggle, dropdownPos }`.
- `ProductFilter.tsx` is refactored to call this hook and use its return values for rendering.
- Position is recalculated inside the hook on both `open` change and scroll events.

---

## Testing Decisions

**What makes a good test here:** Test the module's observable output given varied inputs. Do not assert internal state (e.g., don't verify that `params.length` is a specific number mid-build). Do not mock the module under test.

### Modules to test:

| Refactor | Module | Test type |
|---|---|---|
| 1 | `QueryBuilder` | Unit — assert `build()` output for combinations of `add`, `addIf`, `addIn` |
| 1 | Chart services (post-refactor) | Integration (existing `.spec.ts`) — behavior must be unchanged |
| 2 | `useFetchChartData` | Unit via `@testing-library/react-hooks` or `renderHook` |
| 3 | `useFilters` | Unit via `renderHook` — assert state transitions |
| 5 | `useDismissableDropdown` | Unit via `renderHook` + jsdom events |

**Prior art:** Backend — `src/branches/branches.controller.spec.ts`, `src/charts/sales-history.controller.spec.ts` (Jest + Supertest pattern). Frontend — no existing tests; new tests use Vitest + `@testing-library/react`.

**Refactors 4 (colors) and 3 (Dashboard layout):** No new tests required beyond the existing backend suite passing unchanged. Frontend visual correctness is verified manually.

---

## Out of Scope

- Adding new chart types or endpoints.
- OpenAPI/Swagger documentation.
- HTTPS/Certbot setup (tracked separately as P7).
- PostgreSQL SSL configuration (tracked separately as P26/P27).
- Frontend end-to-end tests (Playwright/Cypress).
- Any changes to the deploy pipeline or Nginx configuration.
- Changing the existing API contract (query param names, response shapes).

---

## Further Notes

- These five refactors are ordered by leverage-to-risk ratio: Refactor 1 and 2 are highest leverage with lowest risk (pure additions); Refactor 3 (Dashboard) is the most invasive and should be done last or in a feature branch.
- Refactor 2 (`useFetchChartData`) is a prerequisite to making Refactor 3 clean — completing 2 before 3 is recommended.
- The existing 67 backend tests must remain green after Refactor 1. Run `pnpm test` before and after.
- `ChartCacheInterceptor` behavior (unique empkey per test) is unaffected by these refactors.
- The `QueryBuilder` (Refactor 1) directly enforces the CLAUDE.md rule "No orphan params" — the implementation rule becomes a compiler/runtime guarantee rather than a convention.
