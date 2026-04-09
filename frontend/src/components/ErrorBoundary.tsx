import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

interface Props { children: ReactNode }
interface State { hasError: boolean }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-page)' }}>
        <div className="fixed inset-0 pointer-events-none" style={{
          backgroundImage: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(37,99,235,0.08) 0%, transparent 70%)',
        }} />
        <div className="relative p-8 rounded-2xl text-center max-w-sm w-full mx-4" style={{
          background: 'var(--bg-card)',
          border: '1px solid rgba(251,113,133,0.2)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{
            background: 'rgba(251,113,133,0.08)', border: '1px solid rgba(251,113,133,0.2)',
          }}>
            <svg className="w-7 h-7" style={{ color: '#fb7185' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h2 className="font-display text-xl font-bold mb-2" style={{ color: 'var(--text-bright)', letterSpacing: '-0.02em' }}>
            Algo salió mal
          </h2>
          <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
            Ocurrió un error inesperado al cargar el dashboard.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="filter-pill active"
          >
            Recargar página
          </button>
        </div>
      </div>
    );
  }
}
