import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { SalesHistoryPoint } from '../../api/client';
import { useTheme } from '../../context/ThemeContext';
import { formatCLP, formatCLPFull } from '../../utils/format';
import { formatDayKey } from '../../utils/dateKeys';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomizedAxisTick = (...args: any[]) => {
  const { x, y, payload } = args[0] as { x: number; y: number; payload: { value: number } };
  const { colors } = useTheme();
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={12}
        textAnchor="end"
        fill={colors.chartAxis}
        transform="rotate(-30)"
        style={{ fontSize: 10, fontFamily: 'DM Mono, monospace' }}
      >
        {formatDayKey(payload.value)}
      </text>
    </g>
  );
};

interface Props {
  data: SalesHistoryPoint[];
  loading: boolean;
  error: string | null;
}

interface TooltipContent { active?: boolean; payload?: Array<{ value: number }>; label?: number }
const CustomTooltip = ({ active, payload, label }: TooltipContent) => {
  const { colors } = useTheme();
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2.5 rounded-xl text-xs" style={{
      background: colors.tooltipBg,
      border: `1px solid ${colors.tooltipBorder}`,
      boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
    }}>
      <p className="font-mono mb-1.5" style={{ color: 'var(--text-muted)' }}>{label != null ? formatDayKey(Number(label)) : ''} </p>
      <p className="font-mono font-semibold text-sm" style={{ color: '#60a5fa' }}>
        {formatCLPFull(payload[0].value)}
      </p>
    </div>
  );
};

export default function SalesHistoryChart({ data, loading, error }: Props) {
  const { colors } = useTheme();

  const total = data.reduce((s, d) => s + d.total, 0);

  // Calcular tendencia (última mitad vs primera mitad)
  let trendBadge = null;
  if (data.length >= 4) {
    const half = Math.floor(data.length / 2);
    const firstHalf = data.slice(0, half).reduce((s, d) => s + d.total, 0) / half;
    const secondHalf = data.slice(half).reduce((s, d) => s + d.total, 0) / (data.length - half);
    const pct = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0;
    if (pct >= 1) {
      trendBadge = <span className="badge-up">▲ {pct.toFixed(1)}%</span>;
    } else if (pct <= -1) {
      trendBadge = <span className="badge-down">▼ {Math.abs(pct).toFixed(1)}%</span>;
    } else {
      trendBadge = <span className="badge-neutral">→ Estable</span>;
    }
  }

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-label)', letterSpacing: '0.12em' }}>
            Historial de Ventas
          </p>
          {!loading && !error && data.length > 0 && (
            <div className="flex items-baseline gap-3">
              <p className="font-display text-3xl font-bold" style={{ color: 'var(--text-bright)', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
                {formatCLPFull(total)}
              </p>
              {trendBadge}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!loading && data.length > 0 && (
            <div className="px-2.5 py-1 rounded-lg text-xs font-mono" style={{
              background: 'var(--bg-input)', color: 'var(--text-very-muted)',
              border: '1px solid var(--border-card)',
            }}>
              {data.length} días
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="h-64 space-y-3 pt-2">
          <div className="skeleton h-4 w-3/4" />
          <div className="skeleton h-40 w-full" />
          <div className="flex gap-4">
            {[1,2,3,4].map(i => <div key={i} className="skeleton h-3 flex-1" />)}
          </div>
        </div>
      )}
      {error && (
        <div className="h-64 flex items-center justify-center">
          <div className="text-center">
            <p className="text-xs mb-1" style={{ color: '#fb7185' }}>Error al cargar datos</p>
            <p className="text-xs font-mono" style={{ color: 'var(--text-very-muted)' }}>{error}</p>
          </div>
        </div>
      )}
      {!loading && !error && data.length === 0 && (
        <div className="h-64 flex flex-col items-center justify-center gap-2">
          <svg className="w-8 h-8 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#60a5fa' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-xs" style={{ color: 'var(--text-label)' }}>Sin datos para el período seleccionado</p>
        </div>
      )}
      {!loading && !error && data.length > 0 && (
        <ResponsiveContainer width="100%" height={248}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 15 }}>
            <defs>
              <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="60%" stopColor="#3b82f6" stopOpacity={0.05} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.chartGrid} vertical={false} />
            <XAxis
              dataKey="day"
              tick={<CustomizedAxisTick />}
              tickLine={false}
              axisLine={false}
              minTickGap={20}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={formatCLP}
              tick={{ fontSize: colors.chartAxisSize, fill: colors.chartAxis, fontFamily: 'DM Mono, monospace' }}
              tickLine={false} axisLine={false} width={70}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone" dataKey="total"
              stroke="#3b82f6" strokeWidth={2}
              fill="url(#blueGrad)" dot={false}
              activeDot={{ r: 4, fill: '#60a5fa', stroke: colors.activeDotStroke, strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
