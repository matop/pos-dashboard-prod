import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchProducts } from '../../api/client';
import type { Product } from '../../api/client';
import { useDismissableDropdown } from '../../hooks/useDismissableDropdown';

interface Props {
  empkey: string;
  onChange: (productKeys: number[] | null) => void;
  disabled?: boolean;
}

export default function ProductFilter({ empkey, onChange, disabled = false }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const buttonRef  = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { isOpen: open, toggle: toggleOpen, dropdownPos } = useDismissableDropdown(buttonRef, dropdownRef);

  useEffect(() => { fetchProducts(empkey).then(setProducts); }, [empkey]);

  function toggle(key: number) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      onChange(next.size === 0 ? null : Array.from(next));
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set());
    onChange(null);
  }

  const filtered = search
    ? products.filter(p => p.descripcion.toLowerCase().includes(search.toLowerCase()))
    : products;

  const label =
    selected.size === 0
      ? 'Todos los productos'
      : selected.size === 1
      ? products.find(p => selected.has(p.productokey))?.descripcion ?? '1 producto'
      : `${selected.size} productos`;

  // ✅ FIX: el dropdown se renderiza en document.body via portal
  // Así escapa cualquier overflow:hidden del contenedor padre
  const dropdown = open ? createPortal(
    <div
      ref={dropdownRef}
      style={{
        position: 'absolute',
        top: dropdownPos.top,
        left: dropdownPos.left,
        width: dropdownPos.width,
        zIndex: 9999,
        background: 'var(--bg-dropdown)',
        border: '1px solid var(--border-input)',
        borderRadius: '0.75rem',
        boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
      }}
    >
      <div className="p-2 border-b" style={{ borderColor: 'var(--border-input)' }}>
        <input
          type="text"
          placeholder="Buscar producto…"
          aria-label="Buscar producto"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full text-xs rounded-lg px-3 py-1.5 font-sans"
          style={{
            background: 'var(--bg-input)',
            border: '1px solid var(--border-input)',
            color: 'var(--text-bright)',
            outline: 'none',
          }}
          autoFocus
        />
      </div>
      <div className="max-h-60 overflow-y-auto" role="listbox" aria-label="Lista de productos" aria-multiselectable="true">
        <button
          role="option"
          aria-selected={selected.size === 0}
          onClick={selectAll}
          className="w-full text-left px-3 py-2 text-xs transition-colors"
          style={{
            color: selected.size === 0 ? '#60a5fa' : 'var(--text-mid)',
            background: selected.size === 0 ? 'rgba(96,165,250,0.08)' : 'transparent',
          }}
        >
          Todos los productos
        </button>
        {filtered.map(p => (
          <button
            key={p.productokey}
            role="option"
            aria-selected={selected.has(p.productokey)}
            onClick={() => toggle(p.productokey)}
            className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors hover:bg-white/5"
            style={{ color: selected.has(p.productokey) ? '#60a5fa' : 'var(--text-mid)' }}
          >
            <span
              className="w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center"
              style={{
                background: selected.has(p.productokey) ? '#60a5fa' : 'transparent',
                border: `1px solid ${selected.has(p.productokey) ? '#60a5fa' : 'rgba(96,165,250,0.3)'}`,
              }}
            >
              {selected.has(p.productokey) && (
                <svg className="w-2.5 h-2.5" aria-hidden="true" fill="none" stroke="#080e1c" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
            <span className="truncate">{p.descripcion}</span>
          </button>
        ))}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Productos:</span>
        <button
          ref={buttonRef}
          onClick={disabled ? undefined : toggleOpen}
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={disabled ? 'Filtro de productos deshabilitado' : `Seleccionar productos: ${label}`}
          className={`text-xs rounded-lg px-3 py-1.5 flex items-center gap-2 min-w-[160px] text-left transition-all${disabled ? ' opacity-50 cursor-not-allowed' : ''}`}
          style={{
            background: open ? 'rgba(96,165,250,0.1)' : 'var(--bg-input)',
            border: `1px solid ${open ? 'rgba(96,165,250,0.4)' : 'var(--border-input)'}`,
            color: 'var(--text-mid)',
            outline: 'none',
          }}
        >
          <span className="truncate flex-1">{disabled ? 'Todos los productos' : label}</span>
          <svg
            className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
            style={{ color: 'var(--text-muted)' }}
            aria-hidden="true"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {dropdown}
    </div>
  );
}
