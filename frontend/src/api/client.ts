export interface Branch { ubicod: string; nombre: string; }
export interface Product { productokey: number; descripcion: string; }
export interface SalesHistoryPoint { day: number; total: number; }
export interface TopProductPoint { productokey: number; descripcion: string; total: number; }
export interface SalesComparisonPoint { label: string; total: number; }

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

// Lee la API Key desde las variables de entorno de Vite
const API_KEY = import.meta.env.VITE_API_SECRET_KEY as string;

if (!API_KEY) {
  console.error('[client] VITE_API_SECRET_KEY no está definida en el .env del frontend');
}

// Todos los fetches usan este helper — agrega el header automáticamente
async function apiFetch(path: string, signal?: AbortSignal): Promise<Response> {
  return fetch(path, {
    headers: {
      'x-api-key': API_KEY,
    },
    signal,
  });
}

function buildParams(obj: Record<string, string | number | number[] | null | undefined>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    if (Array.isArray(v)) {
      if (v.length > 0) params.set(k, v.join(','));
    } else {
      params.set(k, String(v));
    }
  }
  return params.toString();
}

export async function fetchBranches(empkey: string): Promise<Branch[]> {
  const res = await apiFetch(`/api/branches?empkey=${empkey}`);
  const data = await res.json();
  return data.branches ?? [];
}

export async function fetchProducts(empkey: string): Promise<Product[]> {
  const res = await apiFetch(`/api/products?empkey=${empkey}`);
  const data = await res.json();
  return data.products ?? [];
}

export async function fetchSalesHistory(params: {
  empkey: string;
  ubicod?: string | null;
  from?: number;
  to?: number;
  products?: number[] | null;
  refDate?: string | null;
  signal?: AbortSignal;
}): Promise<SalesHistoryPoint[]> {
  const { signal, ...rest } = params;
  const qs = buildParams({ ...rest, products: rest.products ?? undefined });
  const res = await apiFetch(`/api/charts/sales-history?${qs}`, signal);
  const data = await res.json();
  return data.data ?? [];
}

export async function fetchTopProducts(params: {
  empkey: string;
  ubicod?: string | null;
  from?: number;
  to?: number;
  products?: number[] | null;
  refDate?: string | null;
  signal?: AbortSignal;
}): Promise<TopProductPoint[]> {
  const { signal, ...rest } = params;
  const qs = buildParams({ ...rest, products: rest.products ?? undefined });
  const res = await apiFetch(`/api/charts/top-products?${qs}`, signal);
  const data = await res.json();
  return data.data ?? [];
}

export async function fetchSalesComparison(params: {
  empkey: string;
  ubicod?: string | null;
  products?: number[] | null;
  refDate?: string | null;
  signal?: AbortSignal;
}): Promise<{ data: SalesComparisonPoint[]; currentHour: number }> {
  const { signal, ...rest } = params;
  const qs = buildParams({ ...rest, products: rest.products ?? undefined });
  const res = await apiFetch(`/api/charts/sales-comparison?${qs}`, signal);
  const json = await res.json();
  return { data: json.data ?? [], currentHour: json.currentHour ?? 0 };
}