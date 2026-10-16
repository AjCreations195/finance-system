import { Component, DestroyRef, Injector, afterNextRender, computed, inject, signal } from '@angular/core';
import { WarehouseItem } from '../../../../core/models/dashboard.models';
import { DashboardDataService } from '../../../../core/services/dashboard-data.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { DashboardCardComponent } from '../../../../shared/components/dashboard-card/dashboard-card.component';
import { LocalizePipe } from '../../../../shared/pipes/localize.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { TableSort } from '../../../../shared/utils/table-sort';
import { IconComponent } from '../../../../shared/components/icon/icon.component';

type SortKey = 'number' | 'product' | 'quantity' | 'min' | 'max';
type BalanceView = 'high' | 'low';

const VISIBLE_ROWS = 5;
/** Row menu width (matches .row-menu-wide in styles.scss), used to place it. */
const ROW_MENU_WIDTH = 224;

/**
 * WarehousesComponent ("المستودعات")
 * --------------------------------
 * Stock levels per product. The "High / Low balances" toggle shows the
 * items with the most / least stock relative to their max order level.
 * Row ⋮ menu: Copy product number, Restock to max level and Delete item
 * (both with confirmation). Esc closes the top-most layer (dialog, then menu).
 */
@Component({
  selector: 'app-warehouses',
  imports: [IconComponent, DashboardCardComponent, TranslatePipe, LocalizePipe],
  templateUrl: './warehouses.component.html',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'onEscape()',
    '(window:resize)': 'rowMenu.set(null)',
  },
})
export class WarehousesComponent {
  protected readonly data = inject(DashboardDataService);
  private readonly language = inject(LanguageService);
  private readonly toast = inject(ToastService);
  private readonly injector = inject(Injector);

  /** Row "⋮" menu: which item, and where (fixed position under the button). */
  protected readonly rowMenu = signal<{ item: WarehouseItem; top: number; left: number } | null>(null);
  /** Items waiting for confirmation (null = dialog closed). */
  protected readonly pendingRestock = signal<WarehouseItem | null>(null);
  protected readonly pendingDelete = signal<WarehouseItem | null>(null);
  private rowMenuTrigger: HTMLElement | null = null;

  constructor() {
    // The page scrolls inside the layout, not the window: close the fixed row menu on any scroll.
    const closeMenu = () => this.rowMenu.set(null);
    document.addEventListener('scroll', closeMenu, { capture: true, passive: true });
    inject(DestroyRef).onDestroy(() => document.removeEventListener('scroll', closeMenu, { capture: true }));
  }

  protected readonly view = signal<BalanceView>('high');
  protected readonly views: BalanceView[] = ['high', 'low'];
  protected readonly sort = new TableSort<SortKey>();
  protected readonly columns: SortKey[] = ['number', 'product', 'quantity', 'min', 'max'];

  protected readonly rows = computed(() => {
    const lang = this.language.lang();
    // Fill ratio = quantity / max. High → highest ratios first; Low → lowest first.
    const ratio = (q: number, max: number) => q / max;
    const byBalance = [...this.data.warehouseItems()].sort((a, b) =>
      this.view() === 'high' ? ratio(b.quantity, b.maxLevel) - ratio(a.quantity, a.maxLevel) : ratio(a.quantity, a.maxLevel) - ratio(b.quantity, b.maxLevel),
    );
    return this.sort.apply(byBalance.slice(0, VISIBLE_ROWS), {
      number: (w) => w.number,
      product: (w) => w.product[lang],
      quantity: (w) => w.quantity,
      min: (w) => w.minLevel,
      max: (w) => w.maxLevel,
    });
  });

  protected pad(n: number): string {
    return String(n).padStart(2, '0');
  }

  /** "05 boxes" style label: padded number + localized unit. */
  protected amount(n: number, item: WarehouseItem): string {
    return `${this.pad(n)} ${item.unit[this.language.lang()]}`;
  }

  protected notAvailable(): void {
    this.toast.show(this.language.translate('login.featureNotAvailable'), 'info');
  }

  // ---- Row menu (⋮) ----
  protected openRowMenu(item: WarehouseItem, event: MouseEvent): void {
    event.stopPropagation();
    if (this.rowMenu()?.item.id === item.id) {
      this.rowMenu.set(null);
      return;
    }
    // Under the ⋮ button, extending toward the table, kept inside the viewport.
    this.rowMenuTrigger = event.currentTarget as HTMLElement;
    const rect = this.rowMenuTrigger.getBoundingClientRect();
    const left = this.language.isRtl() ? rect.left : rect.right - ROW_MENU_WIDTH;
    const maxLeft = window.innerWidth - ROW_MENU_WIDTH - 8;
    this.rowMenu.set({ item, top: rect.bottom + 4, left: Math.max(8, Math.min(left, maxLeft)) });
    afterNextRender(() => document.querySelector<HTMLElement>('.row-menu [role="menuitem"]')?.focus(), { injector: this.injector });
  }

  protected copyNumber(item: WarehouseItem): void {
    this.closeRowMenu();
    const done = () => this.toast.show(this.language.translate('warehouses.toast.numberCopied'), 'success');
    const fail = () => this.toast.show(this.language.translate('requests.details.copyFailed'), 'danger');
    if (!navigator.clipboard) {
      fail();
      return;
    }
    navigator.clipboard.writeText(item.number).then(done, fail);
  }

  protected askRestock(item: WarehouseItem): void {
    this.rowMenu.set(null);
    this.pendingRestock.set(item);
    this.focusDialog();
  }

  protected confirmRestock(): void {
    const item = this.pendingRestock();
    if (!item) return;
    this.data.restockWarehouseItem(item.id);
    this.pendingRestock.set(null);
    const product = item.product[this.language.lang()];
    this.toast.show(this.language.translate('warehouses.toast.restocked', { product, quantity: this.amount(item.maxLevel, item) }), 'success');
  }

  protected askDelete(item: WarehouseItem): void {
    this.rowMenu.set(null);
    this.pendingDelete.set(item);
    this.focusDialog();
  }

  protected confirmDelete(): void {
    const item = this.pendingDelete();
    if (!item) return;
    this.data.deleteWarehouseItem(item.id);
    this.pendingDelete.set(null);
    this.toast.show(this.language.translate('warehouses.toast.deleted', { product: item.product[this.language.lang()] }), 'success');
  }

  // ---- Closing layers ----
  protected onDocumentClick(event: MouseEvent): void {
    if (this.rowMenu() && !(event.target as HTMLElement).closest('.row-menu')) this.rowMenu.set(null);
  }

  /** Esc closes the top-most layer only: a dialog first, then the row menu. */
  protected onEscape(): void {
    if (this.pendingRestock() || this.pendingDelete()) {
      this.pendingRestock.set(null);
      this.pendingDelete.set(null);
    } else if (this.rowMenu()) {
      this.closeRowMenu();
    }
  }

  private closeRowMenu(): void {
    this.rowMenu.set(null);
    this.rowMenuTrigger?.focus();
  }

  /** Confirmation dialogs open with focus on their confirm button. */
  private focusDialog(): void {
    afterNextRender(() => document.querySelector<HTMLElement>('.confirm-modal .confirm-btn')?.focus(), { injector: this.injector });
  }
}
