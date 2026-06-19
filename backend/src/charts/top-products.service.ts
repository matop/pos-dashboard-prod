import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { parseDateParam, parseProductKeys } from '../common/utils/date.utils';
import { QueryBuilder } from '../common/utils/query-builder';

export interface TopProductsParams {
  empkey: number;
  ubicod?: string;
  from?: string;
  to?: string;
  products?: string;
}

interface TopProductItem {
  productokey: number;
  descripcion: string;
  total: number;
}

@Injectable()
export class TopProductsService {
  private readonly logger = new Logger(TopProductsService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getTopProducts(p: TopProductsParams): Promise<{ data: TopProductItem[] }> {
    const { empkey, ubicod, from, to, products } = p;

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

    // products — IN con params individuales (no ANY($N) array)
    qb.addIn('r.dwpproductokey', parseProductKeys(products));

    const { where, params } = qb.build();

    try {
      const rows = await this.dataSource.query<
        Array<{ productokey: string; descripcion: string | null; total: string }>
      >(
        `SELECT r.dwpproductokey AS productokey,
                TRIM(p.dwpproductodescripcion) AS descripcion,
                SUM(r.dwptotalmonto) AS total
         FROM dwpreporte r
         LEFT JOIN dwpproducto p
           ON r.dwpproductokey = p.dwpproductokey AND r.dwpempkey = p.dwpempkey
         ${where}
         GROUP BY r.dwpproductokey, p.dwpproductodescripcion
         ORDER BY total DESC`,
        params,
      );

      return {
        data: rows.map((row) => ({
          productokey: Number(row.productokey),
          descripcion: row.descripcion ?? `Producto ${row.productokey}`,
          total: Number(row.total),
        })),
      };
    } catch (e: unknown) {
      if (e instanceof BadRequestException) throw e;
      this.logger.error('Error en consulta topProducts', {
        error: e instanceof Error ? e.message : String(e),
        empkey,
      });
      throw new InternalServerErrorException('Error interno del servidor');
    }
  }
}
