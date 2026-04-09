import Dashboard from './components/Dashboard';
import ErrorBoundary from './components/ErrorBoundary';
import { parseRefDateString } from './utils/dateKeys';

function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('refDate');
  return {
    empkey: params.get('empkey'),
    ubicod: params.get('ubicod'),
    refDate: raw && parseRefDateString(raw) ? raw : null,
  };
}

export default function App() {
  const { empkey, ubicod , refDate } = getUrlParams();

  if (!empkey) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-page)' }}>
        {/* Fondo */}
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
            Empresa no especificada
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            Agrega el parámetro{' '}
            <code className="px-1.5 py-0.5 rounded font-mono text-xs" style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa' }}>
              ?empkey=
            </code>{' '}
            a la URL para cargar el dashboard.
          </p>
          <p className="text-xs font-mono py-2 px-3 rounded-lg" style={{ color: 'var(--text-very-muted)', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-card)' }}>
            Ejemplo: /?empkey=1136
          </p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Dashboard empkey={empkey} initialUbicod={ubicod} refDate={refDate} />
    </ErrorBoundary>
  );
}
