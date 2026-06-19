/**
 * Builds parameterized PostgreSQL WHERE clauses without manual $N index tracking.
 *
 * Usage:
 *   const qb = new QueryBuilder(empkey);
 *   qb.add('col = $?', value);
 *   qb.addIf(condition, 'col >= $?', value);
 *   qb.addIn('col', [v1, v2, v3]);
 *   const { where, params } = qb.build();
 *
 * For services that embed custom CASE expressions (e.g. sales-comparison):
 *   const idx = qb.push(value);   // returns 1-based $N index
 *   const extras = qb.extraConditions; // conditions[1..n], without empkey
 *   const params = [...qb.params];    // full params snapshot
 */
export class QueryBuilder {
  private readonly _params: unknown[] = [];
  private readonly _conditions: string[] = [];

  constructor(empkey: number) {
    this._params.push(empkey);
    this._conditions.push('r.dwpempkey = $1');
  }

  /** Adds a condition. Use `$?` as the placeholder — it will be replaced with `$N`. */
  add(sql: string, value: unknown): this {
    this._params.push(value);
    this._conditions.push(sql.replace('$?', `$${this._params.length}`));
    return this;
  }

  /** Adds a condition only if `condition` is true. No-op otherwise. */
  addIf(condition: boolean, sql: string, value: unknown): this {
    if (condition) this.add(sql, value);
    return this;
  }

  /**
   * Adds an IN clause for `column`. No-op if `values` is empty.
   * Generates individual `$N` params — never an array cast.
   */
  addIn(column: string, values: unknown[]): this {
    if (values.length === 0) return this;
    const startIdx = this._params.length + 1;
    const placeholders = values.map((_, i) => `$${startIdx + i}`).join(', ');
    values.forEach(v => this._params.push(v));
    this._conditions.push(`${column} IN (${placeholders})`);
    return this;
  }

  /**
   * Pushes a raw param and returns its 1-based SQL index.
   * Use this for CASE expressions or other constructs that need the index explicitly.
   */
  push(value: unknown): number {
    this._params.push(value);
    return this._params.length;
  }

  /** Returns conditions[1..n] — all except the empkey condition. */
  get extraConditions(): readonly string[] {
    return this._conditions.slice(1);
  }

  /** Returns the current params array (live reference, readonly). */
  get params(): readonly unknown[] {
    return this._params;
  }

  /** Returns `{ where: 'WHERE ...', params: unknown[] }`. */
  build(): { where: string; params: unknown[] } {
    return {
      where: 'WHERE ' + this._conditions.join(' AND '),
      params: [...this._params],
    };
  }
}
