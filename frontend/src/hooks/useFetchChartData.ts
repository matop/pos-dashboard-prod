import { useEffect, useReducer } from 'react';
import { isAbortError } from '../api/client';

type State<T> = { data: T; loading: boolean; error: string | null };
type Action<T> =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: T }
  | { type: 'FETCH_ERROR'; payload: string };

function reducer<T>(s: State<T>, a: Action<T>): State<T> {
  switch (a.type) {
    case 'FETCH_START':   return { ...s, loading: true, error: null };
    case 'FETCH_SUCCESS': return { data: a.payload, loading: false, error: null };
    case 'FETCH_ERROR':   return { ...s, loading: false, error: a.payload };
  }
}

/**
 * Encapsulates the fetch/abort/error pattern shared by all chart components.
 * @param fetchFn  receives an AbortSignal, returns a Promise<T>
 * @param deps     effect dependency array (treated like useEffect deps)
 * @param initialData  initial value for `data` before first successful fetch
 */
export function useFetchChartData<T>(
  fetchFn: (signal: AbortSignal) => Promise<T>,
  deps: unknown[],
  initialData: T,
): State<T> {
  const [state, dispatch] = useReducer(
    reducer as (s: State<T>, a: Action<T>) => State<T>,
    { data: initialData, loading: true, error: null },
  );

  useEffect(() => {
    const controller = new AbortController();
    dispatch({ type: 'FETCH_START' });
    fetchFn(controller.signal)
      .then(d  => dispatch({ type: 'FETCH_SUCCESS', payload: d }))
      .catch(e => { if (!isAbortError(e)) dispatch({ type: 'FETCH_ERROR', payload: e.message }); });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
