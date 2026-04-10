/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

type Theme = 'dark' | 'light';

export interface ThemeColors {
  chartAxis: string;
  chartGrid: string;
  chartAxisSize: number;
  tooltipBg: string;
  tooltipBorder: string;
  activeDotStroke: string;
  barTrack: string;
  cursor: string;
}

const DARK_COLORS: ThemeColors = {
  chartAxis: '#718096',
  chartGrid: 'rgba(255,255,255,0.03)',
  chartAxisSize: 11,
  tooltipBg: '#0d1e3a',
  tooltipBorder: 'rgba(59,130,246,0.3)',
  activeDotStroke: '#060b18',
  barTrack: 'rgba(255,255,255,0.04)',
  cursor: 'rgba(255,255,255,0.02)',
};

const LIGHT_COLORS: ThemeColors = {
  chartAxis: '#718096',
  chartGrid: 'rgba(0,0,0,0.06)',
  chartAxisSize: 11,
  tooltipBg: '#ffffff',
  tooltipBorder: 'rgba(59,130,246,0.2)',
  activeDotStroke: '#f0f4f8',
  barTrack: 'rgba(0,0,0,0.06)',
  cursor: 'rgba(0,0,0,0.03)',
};

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
  colors: ThemeColors;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = (localStorage.getItem('pos-theme') as Theme) ?? 'light';
    document.documentElement.setAttribute('data-theme', saved);
    return saved;
  });

  const toggle = useCallback(() => {
    setTheme(prev => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('pos-theme', next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ theme, toggle, colors: theme === 'dark' ? DARK_COLORS : LIGHT_COLORS }),
    [theme, toggle]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
