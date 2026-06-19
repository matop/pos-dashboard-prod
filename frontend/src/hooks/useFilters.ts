import { useState, useMemo } from 'react';
import type { TimeRange } from '../components/filters/TimeRangeFilter';
import { dateToKey, parseRefDateString } from '../utils/dateKeys';

function getDefaultTimeRange(refDate: string | null): TimeRange {
  const to = refDate ? parseRefDateString(refDate) ?? new Date() : new Date();
  const from = new Date(to);
  from.setDate(to.getDate() - 29);
  return { from: dateToKey(from), to: dateToKey(to) };
}

export interface Filters {
  ubicod: string | null;
  branchName: string | null;
  timeRange: TimeRange;
  timeRangeLabel: string | null;
  products: number[] | null;
  filtersOpen: boolean;
}

export function useFilters(initialUbicod: string | null, refDate: string | null) {
  const [ubicod, setUbicod] = useState<string | null>(initialUbicod);
  const [branchName, setBranchName] = useState<string | null>(null);
  const [timeRange, setTimeRangeState] = useState<TimeRange>(() => getDefaultTimeRange(refDate));
  const [timeRangeLabel, setTimeRangeLabel] = useState<string | null>('Últimos 30 días');
  const [products, setProducts] = useState<number[] | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(() =>
    localStorage.getItem('pos-filters-open') !== 'false'
  );
  const [refreshKey, setRefreshKey] = useState(0);

  const defaultRange = useMemo(() => getDefaultTimeRange(refDate), [refDate]);

  const activeFilterCount = useMemo(() => [
    ubicod !== null,
    products !== null,
    timeRange.from !== defaultRange.from || timeRange.to !== defaultRange.to,
  ].filter(Boolean).length, [ubicod, products, timeRange, defaultRange]);

  function setTimeRange(range: TimeRange, label: string | null) {
    setTimeRangeState(range);
    setTimeRangeLabel(label);
  }

  function toggleFilters() {
    setFiltersOpen(v => {
      const next = !v;
      localStorage.setItem('pos-filters-open', String(next));
      return next;
    });
  }

  function refresh() {
    setRefreshKey(k => k + 1);
  }

  const filters: Filters = { ubicod, branchName, timeRange, timeRangeLabel, products, filtersOpen };

  return { filters, refreshKey, setUbicod, setBranchName, setTimeRange, setProducts, toggleFilters, activeFilterCount, refresh };
}
