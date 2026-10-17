import { Component, DestroyRef, Injector, afterNextRender, computed, inject, signal } from '@angular/core';
import { TRANSACTION_TYPES, TransactionItem } from '../../../../core/models/dashboard.models';
import { ClipboardService } from '../../../../core/services/clipboard.service';
import { DashboardDataService } from '../../../../core/services/dashboard-data.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { DashboardCardComponent } from '../../../../shared/components/dashboard-card/dashboard-card.component';
import { FilterMenuComponent, FilterOption } from '../../../../shared/components/filter-menu/filter-menu.component';
import { LocalizePipe } from '../../../../shared/pipes/localize.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { TableSort } from '../../../../shared/utils/table-sort';
import { IconComponent } from '../../../../shared/components/icon/icon.component';

type SortKey = 'number' | 'type' | 'employee' | 'duration';

/** Duration converted to days, so rows sort correctly across units. */
const UNIT_DAYS = { day: 1, week: 7, month: 30, year: 365 } as const;
/** Row menu width (matches .row-menu-wide in styles.scss), used to place it. */
const ROW_MENU_WIDTH = 224;

/**
 * RecentTransactionsComponent ("المعاملات الأخيرة")
 * -----------------------------------------------
 * Compact table with type filter, search and sorting.
 * Row ⋮ menu: Copy transaction number and Hide from recent (with confirmation).
 * Esc closes the top-most layer (dialog, then menu).
 */
@Component({
  selector: 'app-recent-transactions',
  imports: [IconComponent, DashboardCardComponent, FilterMenuComponent, TranslatePipe, LocalizePipe],
  templateUrl: './recent-transactions.component.html',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'onEscape()',
    '(window:resize)': 'rowMenu.set(null)',
  },
})
export class RecentTransactionsComponent {
  protected readonly data = inject(DashboardDataService);
  private readonly language = inject(LanguageService);
  protected readonly toast = inject(ToastService);
  private readonly clipboard = inject(ClipboardService);
  private readonly injector = inject(Injector);

  /** Row "⋮" menu: which transaction, and where (fixed position under the button). */
  protected readonly rowMenu = signal<{ item: TransactionItem; top: number; left: number } | null>(null);
  /** Transaction waiting for the hide confirmation (null = dialog closed). */
  protected readonly pendingHide = signal<TransactionItem | null>(null);
  private rowMenuTrigger: HTMLElement | null = null;

  constructor() {
    // The page scrolls inside the layout, not the window: close the fixed row menu on any scroll.
    const closeMenu = () => this.rowMenu.set(null);
    document.addEventListener('scroll', closeMenu, { capture: true, passive: true });
    inject(DestroyRef).onDestroy(() => document.removeEventListener('scroll', closeMenu, { capture: true }));
  }

  /** Search text (transaction number or employee name). */
  protected readonly search = signal('');
  /** Type filter: 'all' or one transaction type. */
  protected readonly type = signal('all');
  /** Column sort state (see TableSort). */
  protected readonly sort = new TableSort<SortKey>();
  /** Sortable columns, in display order. */
  protected readonly columns: SortKey[] = ['number', 'type', 'employee', 'duration'];

  /** Options of the type filter: All, then one per transaction type. */
  protected readonly typeOptions: FilterOption[] = [
    { value: 'all', label: 'common.all' },
    ...TRANSACTION_TYPES.map((t) => ({ value: t, label: `transactions.types.${t}` })),
  ];

  /** The transactions after type filter, search and sort: what the table shows. */
  protected readonly rows = computed(() => {
    const q = this.search().trim().toLowerCase();
    const type = this.type();
    const lang = this.language.lang();
    const filtered = this.data
      .transactions()
      .filter(
        (t) =>
          (type === 'all' || t.type === type) &&
          (!q || t.number.toLowerCase().includes(q) || t.employee.name[lang].toLowerCase().includes(q)),
      );
    return this.sort.apply(filtered, {
      number: (t) => t.number,
      type: (t) => this.language.translate(`transactions.types.${t.type}`),
      employee: (t) => t.employee.name[lang],
      duration: (t) => t.duration.value * UNIT_DAYS[t.duration.unit],
    });
  });

  /** "01 day" style label from the design. */
  protected duration(t: TransactionItem): string {
    return `${String(t.duration.value).padStart(2, '0')} ${this.language.translate(`transactions.units.${t.duration.unit}`)}`;
  }

  // ---- Row menu (⋮) ----
  protected openRowMenu(item: TransactionItem, event: MouseEvent): void {
    event.stopPropagation();
    if (this.rowMenu()?.item.id === item.id) {
      this.rowMenu.set(null);
      return;
    }
    // Under the ⋮ button, extending toward the table.
    this.rowMenuTrigger = event.currentTarget as HTMLElement;
    const rect = this.rowMenuTrigger.getBoundingClientRect();
    const left = this.language.isRtl() ? rect.left : rect.right - ROW_MENU_WIDTH;
    // Kept inside the viewport on both sides (phones).
    const maxLeft = window.innerWidth - ROW_MENU_WIDTH - 8;
    this.rowMenu.set({ item, top: rect.bottom + 4, left: Math.max(8, Math.min(left, maxLeft)) });
    afterNextRender(() => document.querySelector<HTMLElement>('.row-menu [role="menuitem"]')?.focus(), { injector: this.injector });
  }

  /** Copies the transaction number and closes the row menu. */
  protected copyNumber(item: TransactionItem): void {
    this.closeRowMenu();
    this.clipboard.copy(item.number, 'transactions.toast.numberCopied');
  }

  /** Hide needs confirmation, so this only opens the dialog (focus goes to its danger button). */
  protected askHide(item: TransactionItem): void {
    this.rowMenu.set(null);
    this.pendingHide.set(item);
    afterNextRender(() => document.querySelector<HTMLElement>('.confirm-modal .btn-danger')?.focus(), { injector: this.injector });
  }

  /** Hides the transaction from this list (it still counts in the total). */
  protected confirmHide(): void {
    const item = this.pendingHide();
    if (!item) return;
    this.data.hideTransaction(item.id);
    this.pendingHide.set(null);
    this.toast.show(this.language.translate('transactions.toast.hidden', { number: item.number }), 'success');
  }

  // ---- Closing layers ----
  protected onDocumentClick(event: MouseEvent): void {
    if (this.rowMenu() && !(event.target as HTMLElement).closest('.row-menu')) this.rowMenu.set(null);
  }

  /** Esc closes the top-most layer only: the dialog first, then the row menu. */
  protected onEscape(): void {
    if (this.pendingHide()) this.pendingHide.set(null);
    else if (this.rowMenu()) this.closeRowMenu();
  }

  private closeRowMenu(): void {
    this.rowMenu.set(null);
    this.rowMenuTrigger?.focus();
  }
}
