import { Injectable, Logger } from '@nestjs/common';

interface CacheEntry {
  value: '1' | '2';
  expiresAt: number;
}

interface GeneXusParamsResponse {
  ok?: boolean;
  resultado?: {
    Ok?: boolean;
    ParametrosValuesApp?: {
      ParametroValueArray?: Array<{
        ParametroId?: string;
        ParametroJerarquia?: string;
        Persistencia?: string;
        ValorInstanciado?: boolean;
        ValorJerarquia?: string;
        ValorParametroFin?: string;
        ValorParametroIni?: string;
        ValorParametroValor?: string;
      }>;
    };
  };
}

@Injectable()
export class ParamsService {
  private readonly logger = new Logger(ParamsService.name);
  private readonly sidecarUrl: string;
  private readonly appId: string;
  private readonly cacheTtlMs = 5 * 60 * 1000; // 5 minutes
  private readonly cache = new Map<number, CacheEntry>();

  constructor() {
    this.sidecarUrl = process.env.PARAMS_SIDECAR_URL ?? 'http://localhost:3002';
    this.appId = process.env.PARAMS_APP_ID ?? '';
  }

  async getParams(empkey: number): Promise<{ topMode: '1' | '2' }> {
    const cached = this.cache.get(empkey);
    if (cached && Date.now() < cached.expiresAt) {
      return { topMode: cached.value };
    }

    const topMode = await this.fetchTopMode(empkey);
    this.cache.set(empkey, { value: topMode, expiresAt: Date.now() + this.cacheTtlMs });
    return { topMode };
  }

  private async fetchTopMode(empkey: number): Promise<'1' | '2'> {
    if (!this.appId) {
      return '1';
    }
    try {
      const url = `${this.sidecarUrl}/parameter/values?app=${encodeURIComponent(this.appId)}&alcance=&parametro=DashboardTopMode&empkey=${empkey}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return '1';
      const json = (await res.json()) as GeneXusParamsResponse;
      return this.extractTopMode(json);
    } catch (err) {
      this.logger.warn(
        `ParamsService: sidecar call failed — ${err instanceof Error ? err.message : String(err)}`,
      );
      return '1';
    }
  }

  private extractTopMode(json: GeneXusParamsResponse): '1' | '2' {
    const array = json?.resultado?.ParametrosValuesApp?.ParametroValueArray;
    if (!Array.isArray(array)) return '1';
    const entry = array.find((e) => e.ParametroId === 'DashboardTopMode');
    if (!entry) return '1';
    const val = entry.ValorParametroValor;
    if (val === 'Producto') return '1';
    if (val === 'Categoria') return '2';
    return '1';
  }
}
