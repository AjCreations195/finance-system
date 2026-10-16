import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DashboardDataService } from '../../../../core/services/dashboard-data.service';
import { ToastService } from '../../../../core/services/toast.service';
import { WarehousesComponent } from './warehouses.component';

describe('WarehousesComponent', () => {
  let fixture: ComponentFixture<WarehousesComponent>;
  let component: WarehousesComponent;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [WarehousesComponent] }).compileComponents();
    fixture = TestBed.createComponent(WarehousesComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  /** Stock fill ratio of each visible row. */
  const ratios = () => component['rows']().map((w) => w.quantity / w.maxLevel);

  it('shows at most 5 rows', () => {
    expect(component['rows']().length).toBe(5);
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(5);
  });

  it('"High" lists the fullest items first', () => {
    const r = ratios();
    expect(r).toEqual([...r].sort((a, b) => b - a));
    expect(component['rows']()[0].id).toBe(7); // coffee: 36 / 40
  });

  it('"Low" lists the emptiest items first', () => {
    component['view'].set('low');
    const r = ratios();
    expect(r).toEqual([...r].sort((a, b) => a - b));
    expect(component['rows']()[0].id).toBe(1); // sugar: 1 / 31
  });

  it('a column sort re-orders the visible rows', () => {
    component['sort'].toggle('quantity');
    const quantities = component['rows']().map((w) => w.quantity);
    expect(quantities).toEqual([...quantities].sort((a, b) => a - b));
  });

  // ---- Row menu (⋮) ----
  describe('row menu', () => {
    const el = () => fixture.nativeElement as HTMLElement;
    const items = () => TestBed.inject(DashboardDataService).warehouseItems();
    const click = async (target: HTMLElement) => {
      target.click();
      await fixture.whenStable();
    };
    const openMenu = (row: number) => click(el().querySelector<HTMLButtonElement>(`tbody tr:nth-child(${row}) .row-actions button`)!);
    const menuItem = (label: string) =>
      Array.from(el().querySelectorAll<HTMLButtonElement>('.row-menu [role="menuitem"]')).find((b) => b.textContent!.includes(label))!;

    beforeEach(async () => {
      component['view'].set('low'); // row 1 = sugar (1 / 31 bags)
      await fixture.whenStable();
    });

    it('the ⋮ column is pinned on phones and opens a menu with three actions', async () => {
      expect(el().querySelector('thead th.actions-col')).not.toBeNull();
      await openMenu(1);
      expect(el().querySelector('tbody tr:nth-child(1) .row-actions button')!.getAttribute('aria-expanded')).toBe('true');
      expect(el().querySelectorAll('.row-menu [role="menuitem"]').length).toBe(3);

      await click(document.body);
      expect(el().querySelector('.row-menu')).toBeNull();
    });

    it('Copy product number copies it', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      await openMenu(1);
      await click(menuItem('Copy product number'));
      await Promise.resolve();
      expect(writeText).toHaveBeenCalledWith('BDRS/2026/BR/8008');
    });

    it('Restock asks first (from → to), then fills the item to its max level', async () => {
      await openMenu(1);
      await click(menuItem('Restock to max level'));
      const dialog = el().querySelector('.confirm-modal')!;
      expect(dialog.textContent).toContain('01 bag');
      expect(dialog.textContent).toContain('31 bag');
      expect(items().find((w) => w.id === 1)!.quantity).toBe(1);

      await click(dialog.querySelector<HTMLButtonElement>('.confirm-btn')!);
      expect(items().find((w) => w.id === 1)!.quantity).toBe(31);
      expect(TestBed.inject(ToastService).toasts().at(-1)?.type).toBe('success');
    });

    it('Restock is disabled for an item that is already full', async () => {
      TestBed.inject(DashboardDataService).restockWarehouseItem(1);
      component['view'].set('high');
      await fixture.whenStable();
      await openMenu(1); // sugar is now 31 / 31, the fullest
      expect(menuItem('Restock to max level').disabled).toBe(true);
    });

    it('Delete asks first, then removes the item (and lowers the total)', async () => {
      const data = TestBed.inject(DashboardDataService);
      const total = data.warehouseTotal();
      await openMenu(1);
      await click(menuItem('Delete item'));
      expect(el().querySelector('.confirm-modal')!.textContent).toContain('Sugar');

      await click(el().querySelector<HTMLButtonElement>('.confirm-modal .confirm-btn')!);
      expect(items().some((w) => w.id === 1)).toBe(false);
      expect(data.warehouseTotal()).toBe(total - 1);
      expect(component['rows']().length).toBe(5); // the next item moves up
    });

    it('Esc closes the dialog first, then the menu', async () => {
      await openMenu(1);
      await click(menuItem('Delete item'));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await fixture.whenStable();
      expect(el().querySelector('.confirm-modal')).toBeNull();
      expect(items().some((w) => w.id === 1)).toBe(true);

      await openMenu(1);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await fixture.whenStable();
      expect(el().querySelector('.row-menu')).toBeNull();
    });
  });
});
