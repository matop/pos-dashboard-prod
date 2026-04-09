import { useMemo } from 'react';
import type { SalesHistoryPoint } from '../api/client';
import { formatCLP, formatCLPFull } from '../utils/format';
import { formatDayKey } from '../utils/dateKeys';

interface Props {
  data: SalesHistoryPoint[];
  loading: boolean;
}

interface KPI {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  accent: string;
  glow: string;
}

export default function KPICards({ data, loading }: Props) {
  const kpis = useMemo<KPI[]>(() => {
    if (!data.length) return [];

    const total = data.reduce((s, d) => s + d.total, 0);
    const avg = total / data.length;
    const best = data.reduce((a, b) => b.total > a.total ? b : a);
    const worst = data.reduce((a, b) => b.total < a.total ? b : a);
    const days = data.length;
    const dayLabel = (key: number) => formatDayKey(key, 'long');

    return [
      {
        label: 'Total del período',
        value: formatCLP(total),
        sub: `${days} días registrados`,
        accent: '#60a5fa',
        glow: 'rgba(59,130,246,0.15)',
        icon: (
          <svg className="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
      {
        label: 'Promedio diario',
        value: formatCLP(avg),
        sub: formatCLPFull(avg) + ' / día',
        accent: '#2dd4bf',
        glow: 'rgba(45,212,191,0.12)',
        icon: (
          <svg className="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ),
      },
      {
        label: 'Mejor día',
        value: formatCLP(best.total),
        sub: dayLabel(best.day),
        accent: '#a78bfa',
        glow: 'rgba(167,139,250,0.12)',
        icon: (
          <svg className="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        ),
      },
      {
        label: 'Día más bajo',
        value: formatCLP(worst.total),
        sub: dayLabel(worst.day),
        accent: '#fb7185',
        glow: 'rgba(251,113,133,0.1)',
        icon: (
          <svg className="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
          </svg>
        ),
      },
    ];
  }, [data]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0,1,2,3].map(i => (
          <div key={i} className="kpi-card">
            <div className="skeleton h-3 w-24 mb-3" />
            <div className="skeleton h-7 w-32 mb-2" />
            <div className="skeleton h-3 w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (!kpis.length) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi, i) => (
        <div key={i} className="kpi-card" style={{ animationDelay: `${i * 60}ms` }}>
          {/* Glow blob */}
          <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full pointer-events-none"
            style={{ background: kpi.glow, filter: 'blur(20px)' }} />

          <div className="relative">
            {/* Icono */}
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{
              background: `rgba(${hexToRgb(kpi.accent)}, 0.12)`,
              border: `1px solid rgba(${hexToRgb(kpi.accent)}, 0.25)`,
              color: kpi.accent,
            }}>
              {kpi.icon}
            </div>

            <p className="text-xs mb-1.5 font-medium" style={{ color: 'var(--text-label)' }}>{kpi.label}</p>
            <p className="font-display text-2xl font-bold leading-none mb-1.5" style={{ color: kpi.accent, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
              {kpi.value}
            </p>
            <p className="text-xs font-mono" style={{ color: 'var(--text-very-muted)' }}>{kpi.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
