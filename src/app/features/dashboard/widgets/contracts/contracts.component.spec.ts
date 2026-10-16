import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DashboardDataService } from '../../../../core/services/dashboard-data.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ContractsComponent } from './contracts.component';

describe('ContractsComponent', () => {
  let fixture: ComponentFixture<ContractsComponent>;
  let component: ContractsComponent;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [ContractsComponent] }).compileComponents();
    fixture = TestBed.createComponent(ContractsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  const progress = () => component['rows']().map((c) => c.progress);

  it('renders all five contracts', () => {
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(5);
  });

  it.each([
    ['low', [25, 15]],
    ['mid', [55]],
    ['high', [85, 70]],
    ['all', [25, 55, 85, 15, 70]],
  ])('the "%s" progress range keeps %j', (range, expected) => {
    component['range'].set(range);
    expect(progress()).toEqual(expected);
  });

  it('searches by supplier name', () => {
    component['search'].set('ooredoo');
    expect(component['rows']().map((c) => c.id)).toEqual([2]);
  });

  it('sorts by progress', () => {
    component['sort'].toggle('progress');
    expect(progress()).toEqual([15, 25, 55, 70, 85]);
  });

  it('uses the first letter of the supplier as the logo', () => {
    expect(component['initial']('  Qatar Bank')).toBe('Q');
  });

  // ---- Row menu (⋮) ----
  describe('row menu', () => {
    const el = () => fixture.nativeElement as HTMLElement;
    const data = () => TestBed.inject(DashboardDataService);
    const contract = (id: number) => data().contracts().find((c) => c.id === id);
    const click = async (target: HTMLElement) => {
      target.click();
      await fixture.whenStable();
    };
    const openMenu = (row: number) => click(el().querySelector<HTMLButtonElement>(`tbody tr:nth-child(${row}) .row-actions button`)!);
    const menuItem = (label: string) =>
      Array.from(el().querySelectorAll<HTMLButtonElement>('.row-menu [role="menuitem"]')).find((b) => b.textContent!.includes(label))!;

    it('the ⋮ column is pinned on phones and opens a menu with three actions', async () => {
      expect(el().querySelector('thead th.actions-col')).not.toBeNull();
      await openMenu(1);
      expect(el().querySelector('tbody tr:nth-child(1) .row-actions button')!.getAttribute('aria-expanded')).toBe('true');
      expect(el().querySelectorAll('.row-menu [role="menuitem"]').length).toBe(3);

      await click(document.body);
      expect(el().querySelector('.row-menu')).toBeNull();
    });

    it('Copy contract number copies it', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      await openMenu(1);
      await click(menuItem('Copy contract number'));
      await Promise.resolve();
      expect(writeText).toHaveBeenCalledWith('BDRS/2026/BR/8008');
    });

    it('Mark as completed asks first (from → 100%), then sets progress to 100', async () => {
      await openMenu(1); // QNB, 25%
      await click(menuItem('Mark as completed'));
      expect(el().querySelector('.confirm-modal')!.textContent).toContain('25%');
      expect(contract(1)!.progress).toBe(25);

      await click(el().querySelector<HTMLButtonElement>('.confirm-modal .confirm-btn')!);
      expect(contract(1)!.progress).toBe(100);
      expect(TestBed.inject(ToastService).toasts().at(-1)?.type).toBe('success');

      await openMenu(1);
      expect(menuItem('Mark as completed').disabled).toBe(true);
    });

    it('Delete asks first, then removes the contract (and lowers the total)', async () => {
      const total = data().contractsTotal();
      await openMenu(2);
      await click(menuItem('Delete contract'));
      expect(el().querySelector('.confirm-modal')!.textContent).toContain('Ooredoo');

      await click(el().querySelector<HTMLButtonElement>('.confirm-modal .confirm-btn')!);
      expect(contract(2)).toBeUndefined();
      expect(data().contractsTotal()).toBe(total - 1);
      expect(el().querySelectorAll('tbody tr').length).toBe(4);
    });

    it('Esc closes the dialog first, then the menu', async () => {
      await openMenu(1);
      await click(menuItem('Delete contract'));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await fixture.whenStable();
      expect(el().querySelector('.confirm-modal')).toBeNull();
      expect(contract(1)).toBeDefined();

      await openMenu(1);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await fixture.whenStable();
      expect(el().querySelector('.row-menu')).toBeNull();
    });
  });
});
