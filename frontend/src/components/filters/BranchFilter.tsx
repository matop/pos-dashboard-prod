import { useEffect, useState } from 'react';
import { fetchBranches } from '../../api/client';
import type { Branch } from '../../api/client';

interface Props {
  empkey: string;
  initialUbicod: string | null;
  onBranchChange: (ubicod: string | null, nombre: string | null) => void;
}

export default function BranchFilter({ empkey, initialUbicod, onBranchChange }: Props) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selected, setSelected] = useState<string | null>(initialUbicod);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBranches(empkey).then(data => {
      setBranches(data);
      setLoading(false);

      if (!initialUbicod && data.length === 1) {
        setSelected(data[0].ubicod);
        onBranchChange(data[0].ubicod, data[0].nombre);
      } else if (initialUbicod) {
        const match = data.find(b => b.ubicod === initialUbicod);
        onBranchChange(initialUbicod, match?.nombre ?? null);
      } else {
        onBranchChange(null, null);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empkey, initialUbicod]);

  if (loading) return null;

  const isFixed = initialUbicod !== null || branches.length === 1;

  if (isFixed) {
    const branch = branches.find(b => b.ubicod === selected) ?? branches[0];
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Sucursal:</span>
        <span
          className="px-3 py-1 text-xs font-medium rounded-full"
          style={{
            background: 'rgba(45,212,191,0.1)',
            border: '1px solid rgba(45,212,191,0.25)',
            color: '#2dd4bf',
          }}
        >
          {branch?.nombre ?? selected}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Sucursal:</span>
      <select
        value={selected ?? ''}
        onChange={e => {
          const val = e.target.value === '' ? null : e.target.value;
          setSelected(val);
          const match = branches.find(b => b.ubicod === val);
          onBranchChange(val, match?.nombre ?? null);
        }}
        className="text-xs rounded-lg px-3 py-1.5 font-sans"
        style={{
          background: 'var(--bg-input)',
          border: '1px solid var(--border-input)',
          color: 'var(--text-mid)',
          outline: 'none',
          cursor: 'pointer',
        }}
      >
        <option value="" style={{ background: 'var(--bg-surface)' }}>Todas las sucursales</option>
        {branches.map(b => (
          <option key={b.ubicod} value={b.ubicod} style={{ background: 'var(--bg-surface)' }}>
            {b.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}
