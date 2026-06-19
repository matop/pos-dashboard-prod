import { QueryBuilder } from './query-builder';

/** Extracts all $N indices found in a WHERE string. */
function extractIndices(where: string): number[] {
  const matches = where.matchAll(/\$(\d+)/g);
  return [...matches].map(m => parseInt(m[1], 10));
}

/** Asserts every index from 1 to params.length appears at least once in where. */
function assertNoOrphanParams(where: string, params: unknown[]): void {
  const indices = extractIndices(where);
  for (let i = 1; i <= params.length; i++) {
    expect(indices).toContain(i);
  }
}

describe('QueryBuilder', () => {
  describe('build() — empkey only', () => {
    it('generates WHERE r.dwpempkey = $1 with params [empkey]', () => {
      const { where, params } = new QueryBuilder(42).build();
      expect(where).toBe('WHERE r.dwpempkey = $1');
      expect(params).toEqual([42]);
    });
  });

  describe('add()', () => {
    it('appends a condition with $2 and grows params', () => {
      const qb = new QueryBuilder(1);
      qb.add('col = $?', 'foo');
      const { where, params } = qb.build();
      expect(where).toContain('$2');
      expect(where).toContain('col = $2');
      expect(params).toEqual([1, 'foo']);
    });

    it('is chainable and produces sequential indices', () => {
      const { where, params } = new QueryBuilder(1)
        .add('a = $?', 'x')
        .add('b >= $?', 100)
        .build();
      expect(where).toContain('a = $2');
      expect(where).toContain('b >= $3');
      expect(params).toHaveLength(3);
      assertNoOrphanParams(where, params);
    });
  });

  describe('addIf()', () => {
    it('is a no-op when condition is false', () => {
      const qb = new QueryBuilder(5);
      qb.addIf(false, 'col = $?', 999);
      const { where, params } = qb.build();
      expect(where).toBe('WHERE r.dwpempkey = $1');
      expect(params).toEqual([5]);
    });

    it('behaves like add() when condition is true', () => {
      const qb = new QueryBuilder(5);
      qb.addIf(true, 'col = $?', 999);
      const { where, params } = qb.build();
      expect(where).toContain('col = $2');
      expect(params).toEqual([5, 999]);
    });
  });

  describe('addIn()', () => {
    it('is a no-op when values array is empty', () => {
      const qb = new QueryBuilder(7);
      qb.addIn('col', []);
      const { where, params } = qb.build();
      expect(where).toBe('WHERE r.dwpempkey = $1');
      expect(params).toEqual([7]);
    });

    it('generates correct IN clause for 3 values', () => {
      const qb = new QueryBuilder(7);
      qb.addIn('col', [10, 20, 30]);
      const { where, params } = qb.build();
      expect(where).toContain('col IN ($2, $3, $4)');
      expect(params).toEqual([7, 10, 20, 30]);
      assertNoOrphanParams(where, params);
    });

    it('offsets IN indices correctly after a prior add()', () => {
      const qb = new QueryBuilder(1);
      qb.add('a = $?', 'val');
      qb.addIn('b', [100, 200]);
      const { where, params } = qb.build();
      expect(where).toContain('a = $2');
      expect(where).toContain('b IN ($3, $4)');
      expect(params).toEqual([1, 'val', 100, 200]);
      assertNoOrphanParams(where, params);
    });
  });

  describe('chaining add() + addIn()', () => {
    it('produces fully sequential $N indices with no orphans', () => {
      const { where, params } = new QueryBuilder(99)
        .add('x = $?', 'abc')
        .addIn('y', [1, 2, 3])
        .add('z <= $?', 42)
        .build();
      expect(params).toHaveLength(6); // empkey + x + 3 IN vals + z
      assertNoOrphanParams(where, params);
    });
  });

  describe('push()', () => {
    it('returns the correct 1-based index', () => {
      const qb = new QueryBuilder(10);
      expect(qb.push('a')).toBe(2);
      expect(qb.push('b')).toBe(3);
    });

    it('stores the pushed value in params', () => {
      const qb = new QueryBuilder(10);
      qb.push('hello');
      expect(qb.params[1]).toBe('hello');
    });
  });

  describe('extraConditions', () => {
    it('is empty when only empkey condition exists', () => {
      expect(new QueryBuilder(1).extraConditions).toHaveLength(0);
    });

    it('returns conditions slice without the empkey condition', () => {
      const qb = new QueryBuilder(1);
      qb.add('a = $?', 'x');
      qb.addIn('b', [1, 2]);
      const extras = qb.extraConditions;
      expect(extras).toHaveLength(2);
      expect(extras[0]).toContain('a = $2');
      expect(extras[1]).toContain('b IN');
      // empkey condition must NOT appear
      expect(extras.join('')).not.toContain('dwpempkey');
    });
  });

  describe('orphan-params invariant', () => {
    it('never produces an orphan param across mixed operations', () => {
      const qb = new QueryBuilder(55);
      qb.add('region = $?', 'sur');
      qb.addIn('prod', [10, 20, 30]);
      qb.addIf(false, 'skip = $?', 999);
      qb.addIf(true, 'active = $?', true);
      const { where, params } = qb.build();
      assertNoOrphanParams(where, params);
    });
  });
});
