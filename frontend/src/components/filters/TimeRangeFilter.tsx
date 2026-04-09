import { useState } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import { es } from 'date-fns/locale/es';
import 'react-datepicker/dist/react-datepicker.css';
import { dateToKey, keyToDate, parseRefDateString } from '../../utils/dateKeys';

registerLocale('es', es);

export interface TimeRange {
  from: number; // YYYYMMDD
  to: number;   // YYYYMMDD
}

function refDateToDate(refDate: string | null): Date {
  if (!refDate) return new Date();
  return parseRefDateString(refDate) ?? new Date();
}

function getPreset(days: number, refDate: string | null): TimeRange {
  const to = refDateToDate(refDate);
  const from = new Date(to);
  from.setDate(to.getDate() - days + 1);
  return { from: dateToKey(from), to: dateToKey(to) };
}

function getThisYear(refDate: string | null): TimeRange {
  const to = refDateToDate(refDate);
  const from = new Date(to.getFullYear(), 0, 1);
  return { from: dateToKey(from), to: dateToKey(to) };
}

function getPresets(refDate: string | null) {
  return [
    { label: 'Últimos 7 días',  fn: () => getPreset(7,  refDate) },
    { label: 'Últimos 30 días', fn: () => getPreset(30, refDate) },
    { label: 'Últimos 90 días', fn: () => getPreset(90, refDate) },
    { label: 'Este año',        fn: () => getThisYear(refDate) },
  ];
}

interface Props {
  value: TimeRange;
  onChange: (range: TimeRange, label: string | null) => void;
  refDate: string | null;
}

export default function TimeRangeFilter({ value, onChange, refDate }: Props) {
  const [custom, setCustom] = useState(false);
  const presets = getPresets(refDate);
  const maxToDate: Date = refDate ? keyToDate(parseInt(refDate)) : new Date();

  function applyPreset(label: string, fn: () => TimeRange) {
    setCustom(false);
    onChange(fn(), label);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Período:</span>
      {presets.map(p => (
        <button key={p.label} onClick={() => applyPreset(p.label, p.fn)} className="filter-pill">
          {p.label}
        </button>
      ))}
      <button
        onClick={() => setCustom(v => !v)}
        className={`filter-pill ${custom ? 'active' : ''}`}
      >
        Personalizado
      </button>
      {custom && (
        <div className="flex items-center gap-2">
          <DatePicker
            selected={keyToDate(value.from)}
            onChange={(date: Date | null) => {
              if (date) onChange({ ...value, from: dateToKey(date) }, null);
            }}
            dateFormat="dd/MM/yyyy"
            locale="es"
            maxDate={maxToDate}
            name="date-from"
            aria-label="Fecha desde"
            autoComplete="off"
            placeholderText="dd/mm/aaaa"
            showPopperArrow={false}
            className="text-xs rounded-lg px-3 py-1.5 font-mono datepicker-input"
            popperPlacement="bottom-start"
          />
          <span style={{ color: 'var(--text-very-muted)' }}>—</span>
          <DatePicker
            selected={keyToDate(value.to)}
            onChange={(date: Date | null) => {
              if (date) {
                const newTo = dateToKey(date);
                const maxTo = refDate ? parseInt(refDate) : dateToKey(new Date());
                if (newTo > maxTo) return;
                onChange({ ...value, to: newTo }, null);
              }
            }}
            dateFormat="dd/MM/yyyy"
            locale="es"
            maxDate={maxToDate}
            name="date-to"
            aria-label="Fecha hasta"
            autoComplete="off"
            placeholderText="dd/mm/aaaa"
            showPopperArrow={false}
            className="text-xs rounded-lg px-3 py-1.5 font-mono datepicker-input"
            popperPlacement="bottom-start"
          />
        </div>
      )}
    </div>
  );
}
