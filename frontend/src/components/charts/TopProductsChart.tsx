import { useEffect, useMemo, useReducer } from 'react';
import {
  PieChart, Pie, Cell, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { PieLabelRenderProps } from 'recharts';
import { fetchTopProducts, isAbortError } from '../../api/client';
import type { TopProductPoint } from '../../api/client';
import type { TimeRange } from '../filters/TimeRangeFilter';
import { formatCLP } from '../../utils/format';

// ─── Constantes ───────────────────────────────────────────────────────────────
const MAX_SLICES = 8;
const PALETTE = [
  '#60a5fa', '#2dd4bf', '#fbbf24', '#a78bfa',
  '#fb7185', '#34d399', '#f97316', '#818cf8',
];
const COLOR_OTROS = '#4b5563';
const COBERTURA_OBJETIVO = 0.80;
const ANCHO_LABEL_PX = 28;

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface ChartRow {
  nombre:   string;
  total:    number;
  esOtros?: boolean;
  count?:   number;
}

interface Props {
  empkey:    string;
  ubicod:    string | null;
  timeRange: TimeRange;
  products:  number[] | null;
  refDate: string | null; // ← nuevo

}

// ─── Tooltip ─────────────────────────────────────────────────────────────────
function TooltipPersonalizado({ active, payload }: {
  active?:  boolean;
  payload?: { value: number; payload: ChartRow; name: string }[];
}) {
  if (!active || !payload?.length) return null;
  const { value, payload: item } = payload[0];
  return (
    <div className="rounded-lg px-4 py-3 shadow-lg"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)' }}>
      <p className="mb-1 max-w-[220px] truncate text-sm font-semibold"
        style={{ color: 'var(--text-bright)' }}>
        {item.nombre}
      </p>
      {item.esOtros && item.count !== undefined && (
        <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
          {item.count} productos agrupados
        </p>
      )}
      <p className="text-base font-bold" style={{ color: '#60a5fa' }}>
        {value.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 })}
      </p>
    </div>
  );
}

// ─── Label en las porciones ───────────────────────────────────────────────────
function getLabelFill(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (r * 299 + g * 587 + b * 114) / 1000;
  return luminance > 150 ? '#1a202c' : '#ffffff';
}

function LabelPorcion(props: PieLabelRenderProps) {
  const cx          = Number(props.cx          ?? 0);
  const cy          = Number(props.cy          ?? 0);
  const midAngle    = Number(props.midAngle    ?? 0);
  const innerRadius = Number(props.innerRadius ?? 0);
  const outerRadius = Number(props.outerRadius ?? 0);
  const percent     = Number(props.percent     ?? 0);
  const index       = Number(props.index       ?? 0);

  // Nunca mostrar label en slices invisibles
  if (percent < 0.005) return null;

  const RADIAN     = Math.PI / 180;
  const radioMedio = innerRadius + (outerRadius - innerRadius) * 0.55;
  const arco       = radioMedio * (percent * 2 * Math.PI);
  const texto      = `${(percent * 100).toFixed(1)}%`;
  const segmentColor = PALETTE[index % PALETTE.length] ?? COLOR_OTROS;

  // ── Label ADENTRO (arco suficientemente grande) ───────────────────────────
  if (arco >= ANCHO_LABEL_PX) {
    const x = cx + radioMedio * Math.cos(-midAngle * RADIAN);
    const y = cy + radioMedio * Math.sin(-midAngle * RADIAN);
    return (
      <text
        x={x} y={y}
        fill={getLabelFill(segmentColor)}
        textAnchor="middle"
        dominantBaseline="central"
        style={{ fontSize: 11, fontWeight: 700, fontFamily: 'DM Mono, monospace' }}
      >
        {texto}
      </text>
    );
  }

  // ── Label AFUERA con línea conectora (slice pequeño) ─────────────────────
  const RADIO_LINEA_START = outerRadius + 6;   // inicio de la línea (borde del slice)
  const RADIO_LINEA_END   = outerRadius + 18;  // punto "codo" de la línea
  const OFFSET_TEXTO      = 4;                 // separación entre codo y texto

  const cos = Math.cos(-midAngle * RADIAN);
  const sin = Math.sin(-midAngle * RADIAN);

  // Punto en el borde del slice
  const x1 = cx + RADIO_LINEA_START * cos;
  const y1 = cy + RADIO_LINEA_START * sin;

  // Punto "codo" — donde dobla la línea
  const x2 = cx + RADIO_LINEA_END * cos;
  const y2 = cy + RADIO_LINEA_END * sin;

  // El texto se ancla a la derecha o izquierda según el lado del donut
  const anchorTexto = cos >= 0 ? 'start' : 'end';
  const xTexto = x2 + (cos >= 0 ? OFFSET_TEXTO : -OFFSET_TEXTO);

  return (
    <g>
      {/* Línea conectora desde el slice hasta el codo */}
      <line
        x1={x1} y1={y1}
        x2={x2} y2={y2}
        stroke={segmentColor}
        strokeWidth={1}
        strokeOpacity={0.7}
      />
      {/* Pequeña raya horizontal en el codo */}
      <line
        x1={x2} y1={y2}
        x2={x2 + (cos >= 0 ? 6 : -6)} y2={y2}
        stroke={segmentColor}
        strokeWidth={1}
        strokeOpacity={0.7}
      />
      <text
        x={xTexto} y={y2}
        fill={segmentColor === '#4b5563' ? '#94a3b8' : segmentColor}
        textAnchor={anchorTexto}
        dominantBaseline="central"
        style={{ fontSize: 10, fontWeight: 600, fontFamily: 'DM Mono, monospace' }}
      >
        {texto}
      </text>
    </g>
  );
}
// ─── Reducer ─────────────────────────────────────────────────────────────────
interface FetchState { raw: TopProductPoint[]; loading: boolean; error: string | null }
type FetchAction =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: TopProductPoint[] }
  | { type: 'FETCH_ERROR'; payload: string };

function fetchReducer(state: FetchState, action: FetchAction): FetchState {
  switch (action.type) {
    case 'FETCH_START':   return { ...state, loading: true, error: null };
    case 'FETCH_SUCCESS': return { raw: action.payload, loading: false, error: null };
    case 'FETCH_ERROR':   return { ...state, loading: false, error: action.payload };
  }
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function TopProductsChart({ empkey, ubicod, timeRange, products, refDate }: Props) {
  const [state, dispatch] = useReducer(fetchReducer, { raw: [], loading: true, error: null });
  const { raw, loading, error } = state;

  useEffect(() => {
    const controller = new AbortController();
    dispatch({ type: 'FETCH_START' });
    fetchTopProducts({ empkey, ubicod, from: timeRange.from, to: timeRange.to, products, refDate, signal: controller.signal })
      .then(d  => dispatch({ type: 'FETCH_SUCCESS', payload: d }))
      .catch(e => {
        if (!isAbortError(e)) dispatch({ type: 'FETCH_ERROR', payload: e.message });
      });
    return () => controller.abort();
  }, [empkey, ubicod, timeRange.from, timeRange.to, products, refDate]);

  // ── Agrupación "Otros" (memoized) ─────────────────────────────────────────
  const { totalGeneral, chartData } = useMemo(() => {
    const total = raw.reduce((s, d) => s + d.total, 0);
    const visibles: ChartRow[] = [];
    const visiblesSet = new Set<number>();
    let acumulado = 0;

    for (const p of raw) {
      if (visibles.length >= MAX_SLICES) break;
      visibles.push({ nombre: p.descripcion, total: p.total });
      visiblesSet.add(p.productokey);
      acumulado += p.total;
      if (total > 0 && acumulado / total >= COBERTURA_OBJETIVO) break;
    }

    const desbordados = raw.filter(p => !visiblesSet.has(p.productokey));
    if (desbordados.length > 0) {
      visibles.push({
        nombre:  `Otros (${desbordados.length} productos)`,
        total:   desbordados.reduce((s, d) => s + d.total, 0),
        esOtros: true,
        count:   desbordados.length,
      });
    }

    return { totalGeneral: total, chartData: visibles };
  }, [raw]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="card p-6 h-full">

      {/* Encabezado */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest mb-1.5"
            style={{ color: 'var(--text-label)', letterSpacing: '0.12em' }}>
            Top Productos
          </p>
          {!loading && !error && chartData.length > 0 && (
            <p className="font-display text-2xl font-bold"
              style={{ color: 'var(--text-bright)', letterSpacing: '-0.03em' }}>
              {raw.length} productos
            </p>
          )}
        </div>
        {!loading && chartData.length > 0 && (
          <div className="px-2.5 py-1 rounded-lg text-xs font-mono"
            style={{ background: 'var(--bg-input)', color: 'var(--text-very-muted)', border: '1px solid var(--border-card)' }}>
            {formatCLP(totalGeneral)} total
          </div>
        )}
      </div>

      {/* Skeleton */}
      {loading && (
        <div className="flex items-center justify-center h-64">
          <div className="skeleton rounded-full" style={{ width: 180, height: 180 }} />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="h-48 flex items-center justify-center text-xs" style={{ color: '#fb7185' }}>
          Error al cargar datos
        </div>
      )}

      {/* Sin datos */}
      {!loading && !error && chartData.length === 0 && (
        <div className="h-48 flex flex-col items-center justify-center gap-2">
          <svg className="w-8 h-8 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"
            style={{ color: '#60a5fa' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <p className="text-xs" style={{ color: 'var(--text-label)' }}>
            Sin datos para el período seleccionado
          </p>
        </div>
      )}

      {/* Pie Chart */}
      {!loading && !error && chartData.length > 0 && (
        <>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="total"
                nameKey="nombre"
                cx="50%"
                cy="50%"
                outerRadius={110}
                innerRadius={50}
                paddingAngle={2}
                labelLine={false}
                label={LabelPorcion}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.esOtros ? COLOR_OTROS : PALETTE[index % PALETTE.length]}
                    fillOpacity={entry.esOtros ? 0.7 : 1}
                    stroke="transparent"
                  />
                ))}
              </Pie>
              <Tooltip content={<TooltipPersonalizado />} />
            </PieChart>
          </ResponsiveContainer>

          {/* Tabla resumen debajo */}
          <div className="mt-2 space-y-1.5">
            {chartData.map((entry, index) => {
              const pct = totalGeneral > 0
                ? ((entry.total / totalGeneral) * 100).toFixed(1)
                : '0.0';
              const color = entry.esOtros ? COLOR_OTROS : PALETTE[index % PALETTE.length];
              return (
                <div key={index} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }} />
                    <span className="text-xs truncate" style={{ color: 'var(--text-mid)' }}
                      title={entry.nombre}>
                      {entry.nombre}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                      {pct}%
                    </span>
                    <span className="text-xs font-mono font-semibold" style={{ color: entry.esOtros ? 'var(--text-muted)' : color }}>
                      {formatCLP(entry.total)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
