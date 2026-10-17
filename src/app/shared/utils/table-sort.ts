import { signal } from '@angular/core';

/**
 * TableSort
 * ---------
 * Small reusable sort state for the dashboard tables.
 * Click a header once → ascending, again → descending, a third time → unsorted.
 *
 * @example
 *   protected readonly sort = new TableSort<'number' | 'date'>();
 *   rows = computed(() => this.sort.apply(this.items(), { number: r => r.number, date: r => r.date }));
 *   <th [attr.aria-sort]="sort.aria('date')"><button (click)="sort.toggle('date')">…<app-icon [name]="sort.icon('date')" class="sort-icon" /></button></th>
 */
export class TableSort<K extends string> {
  readonly key = signal<K | null>(null);
  readonly dir = signal<'asc' | 'desc'>('asc');

  toggle(key: K): void {
    if (this.key() !== key) {
      this.key.set(key);
      this.dir.set('asc');
    } else if (this.dir() === 'asc') {
      this.dir.set('desc');
    } else {
      this.key.set(null);
    }
  }

  /** Icon name (public/icons) for a header's sort indicator. */
  icon(key: K): string {
    if (this.key() !== key) return 'chevron-expand';
    return this.dir() === 'asc' ? 'chevron-up' : 'chevron-down';
  }

  /** Value for the header's aria-sort attribute. */
  aria(key: K): 'ascending' | 'descending' | 'none' {
    if (this.key() !== key) return 'none';
    return this.dir() === 'asc' ? 'ascending' : 'descending';
  }

  /** Return a sorted copy of `rows` (unchanged order when no column is selected). */
  apply<T>(rows: T[], accessors: Record<K, (row: T) => string | number>): T[] {
    const key = this.key();
    if (!key) return rows;
    const get = accessors[key];
    const factor = this.dir() === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return cmp * factor;
    });
  }
}
