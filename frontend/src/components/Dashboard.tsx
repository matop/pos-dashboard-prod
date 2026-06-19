import { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { fetchSalesHistory } from '../api/client';
import type { SalesHistoryPoint } from '../api/client';
import { useFetchChartData } from '../hooks/useFetchChartData';
import { useFilters } from '../hooks/useFilters';
import TimeRangeFilter from './filters/TimeRangeFilter';
import BranchFilter from './filters/BranchFilter';
import ProductFilter from './filters/ProductFilter';
import SalesHistoryChart from './charts/SalesHistoryChart';
import TopProductsChart from './charts/TopProductsChart';
import TopCategoriesChart from './charts/TopCategoriesChart';
import SalesComparisonChart from './charts/SalesComparisonChart';
import KPICards from './KPICards';
import { useAppParams } from '../hooks/useAppParams';
import { formatDayKey } from '../utils/dateKeys';
import type { TimeRange } from './filters/TimeRangeFilter';

interface Props {
  empkey: string;
  initialUbicod: string | null;
  refDate: string | null;
}

// ─── Clock (isolated to avoid re-rendering the entire Dashboard every 60s) ───

function Clock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const timeLabel = now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  const dateLabel = now.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="hidden sm:block text-right">
      <p className="font-mono text-sm font-medium" style={{ color: '#60a5fa' }}>{timeLabel}</p>
      <p className="text-xs capitalize" style={{ color: 'var(--text-very-muted)' }}>{dateLabel}</p>
    </div>
  );
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export default function Dashboard({ empkey, initialUbicod, refDate }: Props) {
  const { theme, toggle: toggleTheme } = useTheme();
  const {
    filters,
    refreshKey,
    setUbicod,
    setBranchName,
    setTimeRange,
    setProducts,
    toggleFilters,
    activeFilterCount,
    refresh,
  } = useFilters(initialUbicod, refDate);
  const { topMode } = useAppParams(empkey);
  const { ubicod, branchName, timeRange, timeRangeLabel, products, filtersOpen } = filters;

  // ── Shared sales history fetch (used by KPICards + SalesHistoryChart) ─────
  const { data: salesData, loading: salesLoading, error: salesError } = useFetchChartData(
    (signal) => fetchSalesHistory({ empkey, ubicod, from: timeRange.from, to: timeRange.to, products, refDate, signal }),
    [empkey, ubicod, timeRange.from, timeRange.to, products, refDate, refreshKey],
    [] as SalesHistoryPoint[],
  );

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-page)' }}>
      {/* Glow de fondo */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: `
          radial-gradient(ellipse 80% 40% at 50% -10%, rgba(37,99,235,0.1) 0%, transparent 60%),
          radial-gradient(ellipse 40% 30% at 85% 85%, rgba(14,165,233,0.05) 0%, transparent 50%)
        `,
      }} />

      {/* ── Header ── */}
      <header className="relative overflow-hidden px-6 py-4 border-b" style={{
        borderColor: 'var(--border-filter)',
        background: 'var(--bg-header)',
        backdropFilter: 'blur(12px)',
      }}>
        {/* Dot grid */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'radial-gradient(circle, rgba(99,179,237,0.06) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }} />
        {/* Top line glow */}
        <div className="absolute top-0 left-0 right-0 h-px pointer-events-none" style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(59,130,246,0.5) 30%, rgba(14,165,233,0.5) 70%, transparent 100%)',
        }} />

        <div className="relative max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Logo + Título */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{
              background: 'linear-gradient(135deg, rgba(59,130,246,0.25), rgba(14,165,233,0.15))',
              border: '1px solid rgba(59,130,246,0.35)',
              boxShadow: '0 0 16px rgba(59,130,246,0.2)',
            }}>
              <svg className="w-5 h-5" style={{ color: '#60a5fa' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <div>
              <h1 className="font-display text-lg font-bold leading-none" style={{ color: 'var(--text-bright)', letterSpacing: '-0.02em' }}>
                Dashboard de Ventas
              </h1>
              <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-very-muted)' }}>
              </p>
            </div>
          </div>

          {/* Derecha: hora + botones + live */}
          <div className="flex items-center gap-3">
            {/* Fecha y hora */}
            <Clock />

            {/* Botón Filtros */}
            <button
              onClick={toggleFilters}
              className="h-8 px-3 rounded-lg flex items-center gap-1.5 transition-all hover:scale-105 relative"
              style={{
                background: filtersOpen ? 'rgba(59,130,246,0.15)' : 'var(--bg-input)',
                border: `1px solid ${filtersOpen ? 'rgba(59,130,246,0.5)' : 'var(--border-input)'}`,
                color: filtersOpen ? '#60a5fa' : 'var(--text-muted)',
              }}
              aria-label={filtersOpen ? 'Ocultar filtros' : 'Mostrar filtros'}
              aria-expanded={filtersOpen}
              title="Mostrar/ocultar filtros"
            >
              <svg className="w-3.5 h-3.5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
              </svg>
              <span className="text-xs font-medium">Filtros</span>
              {activeFilterCount > 0 && (
                <span
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{ background: '#3b82f6', color: '#fff' }}
                >
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Botón Tema */}
            <button
              onClick={toggleTheme}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110"
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-input)',
                color: 'var(--text-muted)',
              }}
              aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              {theme === 'dark' ? (
                <svg className="w-3.5 h-3.5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 7a5 5 0 100 10A5 5 0 0012 7z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            {/* Botón Refresh */}
            <button
              onClick={refresh}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110"
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-input)',
                color: 'var(--text-muted)',
              }}
              aria-label="Actualizar datos"
              title="Actualizar datos"
            >
              <svg className="w-3.5 h-3.5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            {/* En línea */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium" style={{
              background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.2)', color: '#2dd4bf',
            }}>
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
              En línea
            </div>
          </div>
        </div>
      </header>

      {/* ── Filters bar ── */}
      <div className="sticky top-0 z-10 border-b" style={{
        background: 'var(--bg-filterbar)',
        borderColor: 'var(--border-filter)',
        backdropFilter: 'blur(12px)',
      }}>
        {/* Full panel */}
        <div className={`filter-bar-panel ${filtersOpen ? 'open' : 'closed'}`}>
          <div className="max-w-7xl mx-auto px-6 py-3 flex flex-wrap items-center gap-3">
            <BranchFilter empkey={empkey} initialUbicod={initialUbicod} onBranchChange={(u, n) => { setUbicod(u); setBranchName(n); }} />
            <div className="w-px h-4" style={{ background: 'var(--border-divider)' }} />
            <TimeRangeFilter value={timeRange} onChange={setTimeRange} refDate={refDate} />
            <div className="w-px h-4" style={{ background: 'var(--border-divider)' }} />
            <ProductFilter empkey={empkey} onChange={setProducts} disabled={topMode === '2'} />
          </div>
        </div>

        {/* Collapsed summary */}
        <div className={`filter-chip-summary ${!filtersOpen ? 'visible' : 'hidden'}`}>
          <div className="max-w-7xl mx-auto px-6 py-2 flex items-center gap-2 flex-wrap">
            <ActiveFilterChips ubicod={ubicod} branchName={branchName} timeRange={timeRange} timeRangeLabel={timeRangeLabel} products={products} onExpand={toggleFilters} />
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <main className="relative max-w-7xl mx-auto px-6 py-6 space-y-5">

        {/* KPI Cards */}
        <div className="animate-fade-up">
          <KPICards data={salesData} loading={salesLoading} />
        </div>

        {/* Sales History */}
        <div className="animate-fade-up animation-delay-100">
          <SalesHistoryChart data={salesData} loading={salesLoading} error={salesError} />
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="animate-fade-up animation-delay-200">
            {topMode === '2' ? (
              <TopCategoriesChart
                empkey={empkey}
                ubicod={ubicod ?? ''}
                timeRange={timeRange}
                refDate={refDate ?? ''}
                refreshKey={refreshKey}
              />
            ) : (
              <TopProductsChart
                empkey={empkey}
                ubicod={ubicod}
                timeRange={timeRange}
                products={products}
                refDate={refDate}
                refreshKey={refreshKey}
              />
            )}
          </div>
          <div className="animate-fade-up animation-delay-300">
            <SalesComparisonChart empkey={empkey} ubicod={ubicod} products={products} refDate={refDate} refreshKey={refreshKey} />
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── ActiveFilterChips ────────────────────────────────────────────────────────

interface ChipsProps {
  ubicod: string | null;
  branchName: string | null;
  timeRange: TimeRange;
  timeRangeLabel: string | null;
  products: number[] | null;
  onExpand: () => void;
}

function ActiveFilterChips({ ubicod, branchName, timeRange, timeRangeLabel, products, onExpand }: ChipsProps) {
  const timeChipText = timeRangeLabel
    ? `${timeRangeLabel} (${formatDayKey(timeRange.from, 'short')}–${formatDayKey(timeRange.to, 'short')})`
    : `${formatDayKey(timeRange.from, 'short')}–${formatDayKey(timeRange.to, 'short')}`;

  return (
    <>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Filtros activos:</span>
      <button onClick={onExpand} className="filter-pill">
        Sucursal: {branchName ?? ubicod ?? 'Todas'}
      </button>
      <button onClick={onExpand} className="filter-pill">
        {timeChipText}
      </button>
      {products !== null && (
        <button onClick={onExpand} className="filter-pill active">
          {products.length} {products.length === 1 ? 'producto' : 'productos'}
        </button>
      )}
    </>
  );
}
