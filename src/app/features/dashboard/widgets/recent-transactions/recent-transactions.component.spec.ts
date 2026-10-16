import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RecentTransactionsComponent } from './recent-transactions.component';

describe('RecentTransactionsComponent', () => {
  let fixture: ComponentFixture<RecentTransactionsComponent>;
  let component: RecentTransactionsComponent;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [RecentTransactionsComponent] }).compileComponents();
    fixture = TestBed.createComponent(RecentTransactionsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  const ids = () => component['rows']().map((t) => t.id);

  it('renders the five transactions', () => {
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(5);
  });

  it('marks the ⋮ column for pinning on phones (header and every row)', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('thead th.actions-col')).not.toBeNull();
    expect(el.querySelectorAll('tbody td.actions-col .row-actions button').length).toBe(5);
  });

  it('filters by type', () => {
    component['type'].set('custody');
    expect(ids()).toEqual([2]);
  });

  it('searches by employee name', () => {
    component['search'].set('jassim');
    expect(ids()).toEqual([3]);
  });

  it('sorts durations across units (days < weeks < months < years)', () => {
    component['sort'].toggle('duration');
    component['sort'].toggle('duration'); // descending
    expect(ids()).toEqual([5, 4, 3, 2, 1]);
  });

  it('formats the duration as a padded number with a translated unit', () => {
    const [first] = component['rows']();
    expect(component['duration'](first)).toMatch(/^01 \S+/);
  });

  // ---- Row menu (⋮) ----
  describe('row menu', () => {
    const el = () => fixture.nativeElement as HTMLElement;
    const click = async (target: HTMLElement) => {
      target.click();
      await fixture.whenStable();
    };
    const openMenu = (row: number) => click(el().querySelector<HTMLButtonElement>(`tbody tr:nth-child(${row}) .row-actions button`)!);
    const item = (label: string) =>
      Array.from(el().querySelectorAll<HTMLElement>('.row-menu [role="menuitem"]')).find((b) => b.textContent!.includes(label))!;

    it('opens with three actions and closes on an outside click', async () => {
      await openMenu(2);
      expect(el().querySelector('tbody tr:nth-child(2) .row-actions button')!.getAttribute('aria-expanded')).toBe('true');
      expect(el().querySelectorAll('.row-menu [role="menuitem"]').length).toBe(3);

      await click(document.body);
      expect(el().querySelector('.row-menu')).toBeNull();
    });

    it('Copy transaction number copies it', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      await openMenu(1);
      await click(item('Copy transaction number'));
      await Promise.resolve();
      expect(writeText).toHaveBeenCalledWith('BDRS/2026/BR/8008');
    });

    it('Email employee is a mailto link to that employee', async () => {
      await openMenu(1);
      const link = item('Email employee') as HTMLAnchorElement;
      expect(link.getAttribute('href')).toMatch(/^mailto:\S+@\S+/);
    });

    it('Hide from recent asks first, then removes the row', async () => {
      await openMenu(3);
      await click(item('Hide from recent'));
      expect(el().querySelector('.confirm-modal')!.textContent).toContain('BDRS/2026/BR/8010');
      expect(ids()).toContain(3);

      await click(el().querySelector<HTMLButtonElement>('.confirm-modal .btn-danger')!);
      expect(ids()).not.toContain(3);
      expect(el().querySelector('.confirm-modal')).toBeNull();
    });

    it('Esc closes the dialog first, then the menu', async () => {
      await openMenu(3);
      await click(item('Hide from recent'));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await fixture.whenStable();
      expect(el().querySelector('.confirm-modal')).toBeNull();
      expect(ids()).toContain(3);

      await openMenu(1);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await fixture.whenStable();
      expect(el().querySelector('.row-menu')).toBeNull();
    });
  });
});
