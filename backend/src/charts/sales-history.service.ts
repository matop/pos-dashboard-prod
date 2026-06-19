import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  parseDateParam,
  parseProductKeys,
  parseRefDate,
  toDayKey,
} from '../common/utils/date.utils';
import { QueryBuilder } from '../common/utils/query-builder';

export interface SalesHistoryParams {
  empkey: number;
  ubicod?: string;
  from?: string;
  to?: string;
  refDate?: string;
  products?: string;
}

interface SalesHistoryPoint {
  day: number;
  total: number;
}

@Injectable()
export class SalesHistoryService {
  private readonly logger = new Logger(SalesHistoryService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getSalesHistory(p: SalesHistoryParams): Promise<{ data: SalesHistoryPoint[] }> {
    const { empkey, ubicod, from, to, refDate, products } = p;

    const qb = new QueryBuilder(empkey);

    // refDate — base para effectiveTo cuando no hay `to` explícito
    const refDateParsed = parseRefDate(refDate);

    // ubicod
    if (ubicod) {
      const trimmed = ubicod.trim();
      if (trimmed.length > 50) {
        throw new BadRequestException('ubicod inválido');
      }
      qb.add('TRIM(r.dwpubicod) = $?', trimmed);
    }

    // from
    const fromDate = parseDateParam(from, 'from');
    if (fromDate !== null) {
      qb.add('(r.dwphorakey / 100) >= $?', fromDate);
    }

    // to — jerarquía: to explícito → refDate → hoy
    const toDate = parseDateParam(to, 'to');
    const effectiveTo =
      toDate ?? (refDateParsed ? toDayKey(refDateParsed) : toDayKey(new Date()));
    qb.add('(r.dwphorakey / 100) <= $?', effectiveTo);

    // rango
    if (fromDate !== null && fromDate > effectiveTo) {
      throw new BadRequestException("El parámetro 'from' no puede ser mayor que 'to'");
    }

    // products — IN con params individuales (no ANY($N) array)
    qb.addIn('r.dwpproductokey', parseProductKeys(products));

    const { where, params } = qb.build();

    try {
      const rows = await this.dataSource.query<Array<{ day: string; total: string }>>(
        `SELECT (r.dwphorakey / 100)::bigint AS day,
                SUM(r.dwptotalmonto) AS total
         FROM dwpreporte r
         ${where}
         GROUP BY (r.dwphorakey / 100)
         ORDER BY (r.dwphorakey / 100)`,
        params,
      );

      return {
        data: rows.map((row) => ({
          day: Number(row.day),
          total: Number(row.total),
        })),
      };
    } catch (e: unknown) {
      if (e instanceof BadRequestException) throw e;
      this.logger.error('Error en consulta salesHistory', {
        error: e instanceof Error ? e.message : String(e),
        empkey,
      });
      throw new InternalServerErrorException('Error interno del servidor');
    }
  }
}
