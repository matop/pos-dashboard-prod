import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { parseDateParam } from '../common/utils/date.utils';
import { QueryBuilder } from '../common/utils/query-builder';

export interface TopCategoriesParams {
  empkey: number;
  ubicod?: string;
  from?: string;
  to?: string;
}

interface TopCategoryItem {
  categoria: string;
  total: number;
}

@Injectable()
export class TopCategoriesService {
  private readonly logger = new Logger(TopCategoriesService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getTopCategories(p: TopCategoriesParams): Promise<{ data: TopCategoryItem[] }> {
    const { empkey, ubicod, from, to } = p;

    const qb = new QueryBuilder(empkey);

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

    // to
    const toDate = parseDateParam(to, 'to');
    if (toDate !== null) {
      qb.add('(r.dwphorakey / 100) <= $?', toDate);
    }

    // rango
    if (fromDate !== null && toDate !== null && fromDate > toDate) {
      throw new BadRequestException("El parámetro 'from' no puede ser mayor que 'to'");
    }

    const { where, params } = qb.build();

    try {
      const rows = await this.dataSource.query<
        Array<{ categoria: string | null; total: string }>
      >(
        `SELECT TRIM(cat.dwpn4catnom) AS categoria,
                SUM(r.dwptotalmonto) AS total
         FROM dwpreporte r
         LEFT JOIN dwpproducto p
           ON r.dwpproductokey = p.dwpproductokey AND r.dwpempkey = p.dwpempkey
         LEFT JOIN dwpn4categoriaproducto cat
           ON TRIM(p.dwpn4catcod) = TRIM(cat.dwpn4catcod) AND r.dwpempkey = cat.dwpempkey
         ${where}
         GROUP BY TRIM(cat.dwpn4catcod), TRIM(cat.dwpn4catnom)
         ORDER BY total DESC`,
        params,
      );

      return {
        data: rows.map((row) => ({
          categoria: row.categoria ?? 'Sin categoría',
          total: Number(row.total),
        })),
      };
    } catch (e: unknown) {
      if (e instanceof BadRequestException) throw e;
      this.logger.error('Error en consulta topCategories', {
        error: e instanceof Error ? e.message : String(e),
        empkey,
      });
      throw new InternalServerErrorException('Error interno del servidor');
    }
  }
}
