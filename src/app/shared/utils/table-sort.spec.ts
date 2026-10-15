import { TableSort } from './table-sort';

interface Row {
  name: string;
  amount: number;
}

const ROWS: Row[] = [
  { name: 'Banana', amount: 20 },
  { name: 'apple', amount: 5 },
  { name: 'Cherry', amount: 100 },
];

const ACCESSORS = { name: (r: Row) => r.name, amount: (r: Row) => r.amount };

describe('TableSort', () => {
  let sort: TableSort<'name' | 'amount'>;

  beforeEach(() => {
    sort = new TableSort<'name' | 'amount'>();
  });

  it('starts unsorted', () => {
    expect(sort.key()).toBeNull();
    expect(sort.apply(ROWS, ACCESSORS)).toBe(ROWS);
  });

  it('cycles a column: ascending → descending → unsorted', () => {
    sort.toggle('amount');
    expect([sort.key(), sort.dir()]).toEqual(['amount', 'asc']);

    sort.toggle('amount');
    expect([sort.key(), sort.dir()]).toEqual(['amount', 'desc']);

    sort.toggle('amount');
    expect(sort.key()).toBeNull();
  });

  it('restarts at ascending when switching to another column', () => {
    sort.toggle('amount');
    sort.toggle('amount'); // desc
    sort.toggle('name');
    expect([sort.key(), sort.dir()]).toEqual(['name', 'asc']);
  });

  it('sorts numbers numerically in both directions', () => {
    sort.toggle('amount');
    expect(sort.apply(ROWS, ACCESSORS).map((r) => r.amount)).toEqual([5, 20, 100]);

    sort.toggle('amount');
    expect(sort.apply(ROWS, ACCESSORS).map((r) => r.amount)).toEqual([100, 20, 5]);
  });

  it('sorts strings with localeCompare (case-insensitive order)', () => {
    sort.toggle('name');
    expect(sort.apply(ROWS, ACCESSORS).map((r) => r.name)).toEqual(['apple', 'Banana', 'Cherry']);
  });

  it('returns a sorted copy and never mutates the input', () => {
    const snapshot = [...ROWS];
    sort.toggle('amount');
    const result = sort.apply(ROWS, ACCESSORS);
    expect(result).not.toBe(ROWS);
    expect(ROWS).toEqual(snapshot);
  });

  it('exposes the right icon and aria-sort value for each state', () => {
    expect(sort.icon('name')).toContain('bi-chevron-expand');
    expect(sort.aria('name')).toBe('none');

    sort.toggle('name');
    expect(sort.icon('name')).toContain('bi-chevron-up');
    expect(sort.aria('name')).toBe('ascending');
    expect(sort.aria('amount')).toBe('none');

    sort.toggle('name');
    expect(sort.icon('name')).toContain('bi-chevron-down');
    expect(sort.aria('name')).toBe('descending');
  });
});
