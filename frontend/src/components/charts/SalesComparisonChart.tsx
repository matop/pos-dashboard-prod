import { useEffect, useReducer } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { fetchSalesComparison, isAbortError } from '../../api/client';
import type { SalesComparisonPoint } from '../../api/client';
import { useTheme } from '../../context/ThemeContext';
import { formatCLP, formatCLPFull } from '../../utils/format';
import { dateToKey } from '../../utils/dateKeys';

const BAR_COLORS = ['#3b82f6', 'rgba(96,165,250,0.65)', 'rgba(96,165,250,0.4)', 'rgba(167,139,250,0.55)', 'rgba(167,139,250,0.35)'];

interface Props { empkey: string; ubicod: string | null; products: number[] | null; refDate: string | null }

// ─── Reducer ─────────────────────────────────────────────────────────────────
interface State { data: SalesComparisonPoint[]; currentHour: number; loading: boolean; error: string | null }
type Action =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: { data: SalesComparisonPoint[]; currentHour: number } }
  | { type: 'FETCH_ERROR'; payload: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'FETCH_START':   return { ...state, loading: true, error: null };
    case 'FETCH_SUCCESS': return { data: action.payload.data, currentHour: action.payload.currentHour, loading: false, error: null };
    case 'FETCH_ERROR':   return { ...state, loading: false, error: action.payload };
  }
}

interface TooltipContent { active?: boolean; payload?: Array<{ value: number }>; label?: string }
const CustomTooltip = ({ active, payload, label }: TooltipContent) => {
  const { colors } = useTheme();
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2.5 rounded-xl text-xs" style={{
      background: colors.tooltipBg,
      border: `1px solid ${colors.tooltipBorder}`,
      boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
    }}>
      <p className="font-mono mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="font-mono font-semibold text-sm" style={{ color: '#60a5fa' }}>
        {formatCLPFull(payload[0].value)}
      </p>
    </div>
  );
};

export default function SalesComparisonChart({ empkey, ubicod, products,refDate }: Props) {
  const { colors } = useTheme();
  const [state, dispatch] = useReducer(reducer, { data: [], currentHour: 0, loading: true, error: null });
  const { data, currentHour, loading, error } = state;

  useEffect(() => {
    const controller = new AbortController();
    dispatch({ type: 'FETCH_START' });
    fetchSalesComparison({ empkey, ubicod, products, refDate, signal: controller.signal })
      .then(res => dispatch({ type: 'FETCH_SUCCESS', payload: res }))
      .catch(e => {
        if (!isAbortError(e)) dispatch({ type: 'FETCH_ERROR', payload: e.message });
      });
    return () => controller.abort();
  }, [empkey, ubicod, products, refDate]);

  const todayTotal = data[0]?.total ?? 0;

  // ✅ FIX: usar el máximo de TODOS los valores como referencia para las barras de progreso
  // Así funciona incluso cuando todayTotal = 0 (ej: antes del horario de ventas)
  const maxVal = Math.max(...data.map(d => d.total), 1); // mínimo 1 para evitar división por 0

  function deltaBadge(val: number) {
    // ✅ FIX: si hoy no tiene datos aún, mostrar comparativa absoluta en lugar de porcentaje
    if (todayTotal === 0) {
      return val > 0
        ? <span className="badge-neutral">Sin datos hoy</span>
        : <span className="badge-neutral">—</span>;
    }
    if (val === 0) return <span className="badge-neutral">—</span>;
    const pct = ((todayTotal - val) / val) * 100;
    if (pct >= 1)  return <span className="badge-up">▲ {pct.toFixed(0)}%</span>;
    if (pct <= -1) return <span className="badge-down">▼ {Math.abs(pct).toFixed(0)}%</span>;
    return <span className="badge-neutral">≈ igual</span>;
  }

  return (
    <div className="card p-6 h-full">
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-label)', letterSpacing: '0.12em' }}>
            Comparación de Ventas
          </p>
          {!loading && todayTotal > 0 && (
            <p className="font-display text-2xl font-bold" style={{ color: 'var(--text-bright)', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
              {formatCLPFull(todayTotal)}
            </p>
          )}
        </div>
        {!loading && (() => {
          const todayKey = String(dateToKey(new Date()));
          const showBadge = !refDate || refDate === todayKey;
          return showBadge ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono" style={{
              background: 'rgba(251,191,36,0.06)',
              color: 'var(--accent-amber)',
              border: '1px solid rgba(251,191,36,0.12)',
            }}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--accent-amber)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>hasta {currentHour}:00 hs</span>
            </div>
          ) : null;
        })()}
      </div>

      {loading && (
        <div className="space-y-4 pt-1">
          <div className="skeleton h-32 w-full" />
          <div className="space-y-2.5">
            {[1,2,3,4].map(i => (
              <div key={i} className="flex items-center gap-3">
                <div className="skeleton h-3 w-24 flex-shrink-0" />
                <div className="skeleton h-3 flex-1" />
                <div className="skeleton h-5 w-16 flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="h-48 flex items-center justify-center text-xs" style={{ color: '#fb7185' }}>
          Error al cargar datos
        </div>
      )}

      {!loading && !error && (
        <>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.chartGrid} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: colors.chartAxisSize, fill: colors.chartAxis, fontFamily: 'DM Mono, monospace' }}
                tickLine={false} axisLine={false}
              />
              <YAxis
                tickFormatter={formatCLP}
                tick={{ fontSize: colors.chartAxisSize, fill: colors.chartAxis, fontFamily: 'DM Mono, monospace' }}
                tickLine={false} axisLine={false} width={60}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: colors.cursor }} />
              <Bar dataKey="total" radius={[5, 5, 0, 0]} maxBarSize={52}>
                {data.map((_, i) => (
                  <Cell key={i} fill={BAR_COLORS[i] ?? '#60a5fa'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Comparativas con badge de delta */}
          <div className="mt-4 space-y-2.5">
            {data.slice(1).map((d) => (
              <div key={d.label} className="flex items-center justify-between gap-3">
                <span className="text-xs font-mono flex-shrink-0" style={{ color: 'var(--text-very-muted)', minWidth: 110 }}>
                  {d.label}
                </span>
                {/* ✅ FIX: progress bar usa maxVal en lugar de todayTotal */}
                <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--bar-track)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min((d.total / maxVal) * 100, 100)}%`,
                      background: 'rgba(99,179,237,0.3)',
                      transition: 'width 700ms ease-out',
                    }}
                  />
                </div>
                <span className="text-xs font-mono flex-shrink-0" style={{ color: 'var(--text-muted)', minWidth: 68, textAlign: 'right' }}>
                  {formatCLP(d.total)}
                </span>
                <div className="flex-shrink-0">
                  {deltaBadge(d.total)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
