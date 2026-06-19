import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { parseProductKeys, parseRefDate, toDayKey } from '../common/utils/date.utils';
import { QueryBuilder } from '../common/utils/query-builder';

export interface SalesComparisonParams {
  empkey: number;
  ubicod?: string;
  refDate?: string;
  products?: string;
}

interface SalesComparisonItem {
  label: string;
  total: number;
}

@Injectable()
export class SalesComparisonService {
  private readonly logger = new Logger(SalesComparisonService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getSalesComparison(
    p: SalesComparisonParams,
  ): Promise<{ data: SalesComparisonItem[]; currentHour: number | null }> {
    const { empkey, ubicod, refDate: refDateRaw, products } = p;

    // Validate ubicod early so hasDayData receives a clean trimmed value
    if (ubicod && ubicod.trim().length > 50) {
      throw new BadRequestException('ubicod inválido');
    }
    const trimmedUbicod = ubicod?.trim();

    const refDateParsed = parseRefDate(refDateRaw);
    const explicitRefDate = refDateRaw != null && refDateParsed !== null;
    const realNow = new Date();

    let now: Date;
    let currentHour: number | null;
    let autoShifted = false;

    if (explicitRefDate) {
      now = refDateParsed!;
      // Explicit refDate: show hour badge only if it refers to today
      const todayDayKey = toDayKey(realNow);
      const refDayKey = toDayKey(now);
      currentHour = refDayKey === todayDayKey ? realNow.getHours() : null;
    } else {
      // Auto-shift: detect if today has data
      const todayKey = toDayKey(realNow);
      const hasData = await this.hasDayData(empkey, trimmedUbicod, products, todayKey);
      if (hasData) {
        now = realNow;
        currentHour = realNow.getHours();
      } else {
        // Shift at most 1 day back — no further search even if yesterday = 0
        const yesterday = new Date(realNow);
        yesterday.setDate(realNow.getDate() - 1);
        now = yesterday;
        currentHour = null;
        autoShifted = true;
      }
    }

    const minusOneDay = new Date(now);
    minusOneDay.setDate(now.getDate() - 1);
    const minusOneWeek = new Date(now);
    minusOneWeek.setDate(now.getDate() - 7);
    const minusOneMonth = new Date(now);
    minusOneMonth.setMonth(now.getMonth() - 1);
    const minusOneYear = new Date(now);
    minusOneYear.setFullYear(now.getFullYear() - 1);

    const anchors = autoShifted
      ? [
          { label: 'Ayer',          dayKey: toDayKey(now) },
          { label: 'Hace 2 días',   dayKey: toDayKey(minusOneDay) },
          { label: 'Hace 1 semana', dayKey: toDayKey(minusOneWeek) },
          { label: 'Hace 1 mes',    dayKey: toDayKey(minusOneMonth) },
          { label: 'Hace 1 año',    dayKey: toDayKey(minusOneYear) },
        ]
      : [
          { label: 'Hoy',           dayKey: toDayKey(now) },
          { label: 'Ayer',          dayKey: toDayKey(minusOneDay) },
          { label: 'Hace 1 semana', dayKey: toDayKey(minusOneWeek) },
          { label: 'Hace 1 mes',    dayKey: toDayKey(minusOneMonth) },
          { label: 'Hace 1 año',    dayKey: toDayKey(minusOneYear) },
        ];

    const qb = new QueryBuilder(empkey);

    if (trimmedUbicod) {
      qb.add('TRIM(r.dwpubicod) = $?', trimmedUbicod);
    }

    // products — IN con params individuales (no ANY($N) array)
    qb.addIn('r.dwpproductokey', parseProductKeys(products));

    const extraWhere =
      qb.extraConditions.length > 0 ? 'AND ' + qb.extraConditions.join(' AND ') : '';

    const todayDayKey = toDayKey(realNow);

    // Push currentHour only if today's anchor is present and hour filter applies
    let hourIdx: number | null = null;
    if (currentHour !== null && anchors.some((a) => a.dayKey === todayDayKey)) {
      hourIdx = qb.push(currentHour);
    }

    // CASE expression por cada anchor + índices para IN clause
    const cases: string[] = [];
    const aliases: string[] = [];
    const dayKeyIndices: number[] = [];

    anchors.forEach((anchor, i) => {
      const dkIdx = qb.push(anchor.dayKey);
      dayKeyIndices.push(dkIdx);
      const alias = `total_${i}`;
      aliases.push(alias);

      if (anchor.dayKey === todayDayKey && hourIdx !== null) {
        cases.push(
          `COALESCE(SUM(CASE WHEN (r.dwphorakey/100)=$${dkIdx} AND (r.dwphorakey%100)<=$${hourIdx} THEN r.dwptotalmonto END),0) AS ${alias}`,
        );
      } else {
        cases.push(
          `COALESCE(SUM(CASE WHEN (r.dwphorakey/100)=$${dkIdx} THEN r.dwptotalmonto END),0) AS ${alias}`,
        );
      }
    });

    const inClause = dayKeyIndices.map((i) => `$${i}`).join(', ');
    const params = [...qb.params];

    const sql = `
      SELECT ${cases.join(', ')}
      FROM dwpreporte r
      WHERE r.dwpempkey = $1
        ${extraWhere}
        AND (r.dwphorakey/100) IN (${inClause})
    `;

    try {
      const rows = await this.dataSource.query<Array<Record<string, string>>>(sql, params);
      const row = rows[0] ?? {};

      const data = anchors.map((anchor, i) => ({
        label: anchor.label,
        total: Number(row[aliases[i]] ?? 0),
      }));

      return { data, currentHour };
    } catch (e: unknown) {
      if (e instanceof BadRequestException) throw e;
      this.logger.error('Error en consulta salesComparison', {
        error: e instanceof Error ? e.message : String(e),
        empkey,
        sql,
      });
      throw new InternalServerErrorException('Error interno del servidor');
    }
  }

  /**
   * Returns true if dwpreporte has any row for the given dayKey (YYYYMMDD)
   * filtered by empkey, ubicod, and products. Used to decide auto-shift.
   * Silently returns false on error to avoid blocking the main query.
   */
  private async hasDayData(
    empkey: number,
    trimmedUbicod: string | undefined,
    products: string | undefined,
    dayKey: number,
  ): Promise<boolean> {
    const qb = new QueryBuilder(empkey);

    if (trimmedUbicod) {
      qb.add('TRIM(r.dwpubicod) = $?', trimmedUbicod);
    }

    qb.addIn('r.dwpproductokey', parseProductKeys(products));

    const extraWhere =
      qb.extraConditions.length > 0 ? 'AND ' + qb.extraConditions.join(' AND ') : '';

    const dayKeyIdx = qb.push(dayKey);

    const sql = `
      SELECT COUNT(*)::int AS cnt
      FROM dwpreporte r
      WHERE r.dwpempkey = $1
        ${extraWhere}
        AND (r.dwphorakey/100) = $${dayKeyIdx}
      LIMIT 1
    `;

    try {
      const rows = await this.dataSource.query<Array<{ cnt: string }>>(sql, [...qb.params]);
      return Number(rows[0]?.cnt ?? 0) > 0;
    } catch {
      // Fallback: don't auto-shift if detection fails
      return false;
    }
  }
}
