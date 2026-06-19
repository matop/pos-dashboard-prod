import { useState, useEffect } from 'react';
import { apiFetch } from '../api/client';

export function useAppParams(empkey: string): { topMode: '1' | '2'; loading: boolean } {
  const [topMode, setTopMode] = useState<'1' | '2'>('1');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!empkey) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    apiFetch(`/api/params?empkey=${empkey}`)
      .then((res) => res.json())
      .then((data: { topMode?: string }) => {
        if (!cancelled) {
          setTopMode(data.topMode === '2' ? '2' : '1');
        }
      })
      .catch(() => {
        // Fallback silencioso — mode stays '1'
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [empkey]);

  return { topMode, loading };
}
