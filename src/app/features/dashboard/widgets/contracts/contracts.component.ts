import { Component, DestroyRef, Injector, afterNextRender, computed, inject, signal } from '@angular/core';
import { ContractItem } from '../../../../core/models/dashboard.models';
import { DashboardDataService } from '../../../../core/services/dashboard-data.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { DashboardCardComponent } from '../../../../shared/components/dashboard-card/dashboard-card.component';
import { FilterMenuComponent, FilterOption } from '../../../../shared/components/filter-menu/filter-menu.component';
import { LocalDatePipe } from '../../../../shared/pipes/format.pipes';
import { LocalizePipe } from '../../../../shared/pipes/localize.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { TableSort } from '../../../../shared/utils/table-sort';
import { IconComponent } from '../../../../shared/components/icon/icon.component';

type SortKey = 'number' | 'supplier' | 'date' | 'progress';

/** Row menu width (matches .row-menu-wide in styles.scss), used to place it. */
const ROW_MENU_WIDTH = 224;

/**
 * ContractsComponent ("العقود")
 * ----------------------------
 * Contracts with supplier logo, date and a completion progress bar.
 * The filter narrows by progress range (just started / in progress / almost done).
 * Row ⋮ menu: Copy contract number, Mark as completed and Delete contract
 * (both with confirmation). Esc closes the top-most layer (dialog, then menu).
 */
@Component({
  selector: 'app-contracts',
  imports: [IconComponent, DashboardCardComponent, FilterMenuComponent, TranslatePipe, LocalizePipe, LocalDatePipe],
  templateUrl: './contracts.component.html',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'onEscape()',
    '(window:resize)': 'rowMenu.set(null)',
  },
  styles: `
    .supplier-logo {
      display: inline-grid;
      place-items: center;
      flex-shrink: 0;
      width: 1.5rem; /* same 24px as the logo images */
      height: 1.5rem;
      border-radius: 50%;
      color: #fff;
      font-size: 0.8125rem;
      font-weight: 700;
    }

    /* Supplier logo from the design (multi-color, so an <img>) */
    .supplier-img {
      flex-shrink: 0;
      object-fit: contain;
    }

    .progress-cell {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-width: 9rem;
    }

    /* Design: blue fill on a light blue-grey track, filling from the start side */
    .progress {
      flex: 1;
      height: 0.25rem;
      border-radius: 999px;
      background: #cdd8e3;
      --bs-progress-bar-bg: #4f8ef7;
    }

    :host-context([data-bs-theme='dark']) .progress {
      background: var(--fs-border);
      --bs-progress-bar-bg: #6aa5ff;
    }
  `,
})
export class ContractsComponent {
  protected readonly data = inject(DashboardDataService);
  private readonly language = inject(LanguageService);
  private readonly toast = inject(ToastService);
  private readonly injector = inject(Injector);

  /** Row "⋮" menu: which contract, and where (fixed position under the button). */
  protected readonly rowMenu = signal<{ item: ContractItem; top: number; left: number } | null>(null);
  /** Contracts waiting for confirmation (null = dialog closed). */
  protected readonly pendingComplete = signal<ContractItem | null>(null);
  protected readonly pendingDelete = signal<ContractItem | null>(null);
  private rowMenuTrigger: HTMLElement | null = null;

  constructor() {
    // The page scrolls inside the layout, not the window: close the fixed row menu on any scroll.
    const closeMenu = () => this.rowMenu.set(null);
    document.addEventListener('scroll', closeMenu, { capture: true, passive: true });
    inject(DestroyRef).onDestroy(() => document.removeEventListener('scroll', closeMenu, { capture: true }));
  }

  protected readonly search = signal('');
  protected readonly range = signal('all');
  protected readonly sort = new TableSort<SortKey>();
  protected readonly columns: SortKey[] = ['number', 'supplier', 'date', 'progress'];

  protected readonly rangeOptions: FilterOption[] = [
    { value: 'all', label: 'common.all' },
    { value: 'low', label: '0–33%' },
    { value: 'mid', label: '34–66%' },
    { value: 'high', label: '67–100%' },
  ];

  protected readonly rows = computed(() => {
    const q = this.search().trim().toLowerCase();
    const lang = this.language.lang();
    const range = this.range();
    const inRange = (p: number): boolean => {
      switch (range) {
        case 'low':
          return p <= 33;
        case 'mid':
          return p > 33 && p <= 66;
        case 'high':
          return p > 66;
        default:
          return true;
      }
    };

    const filtered = this.data
      .contracts()
      .filter((c) => inRange(c.progress) && (!q || c.number.toLowerCase().includes(q) || c.supplier[lang].toLowerCase().includes(q)));

    return this.sort.apply(filtered, {
      number: (c) => c.number,
      supplier: (c) => c.supplier[lang],
      date: (c) => c.date,
      progress: (c) => c.progress,
    });
  });

  /** First letter of the supplier name, used as a stand-in logo. */
  protected initial(name: string): string {
    return name.trim().charAt(0);
  }

  protected notAvailable(): void {
    this.toast.show(this.language.translate('login.featureNotAvailable'), 'info');
  }

  // ---- Row menu (⋮) ----
  protected openRowMenu(item: ContractItem, event: MouseEvent): void {
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

  protected copyNumber(item: ContractItem): void {
    this.closeRowMenu();
    const done = () => this.toast.show(this.language.translate('contracts.toast.numberCopied'), 'success');
    const fail = () => this.toast.show(this.language.translate('requests.details.copyFailed'), 'danger');
    if (!navigator.clipboard) {
      fail();
      return;
    }
    navigator.clipboard.writeText(item.number).then(done, fail);
  }

  protected askComplete(item: ContractItem): void {
    this.rowMenu.set(null);
    this.pendingComplete.set(item);
    this.focusDialog();
  }

  protected confirmComplete(): void {
    const item = this.pendingComplete();
    if (!item) return;
    this.data.completeContract(item.id);
    this.pendingComplete.set(null);
    this.toast.show(this.language.translate('contracts.toast.completed', { number: item.number }), 'success');
  }

  protected askDelete(item: ContractItem): void {
    this.rowMenu.set(null);
    this.pendingDelete.set(item);
    this.focusDialog();
  }

  protected confirmDelete(): void {
    const item = this.pendingDelete();
    if (!item) return;
    this.data.deleteContract(item.id);
    this.pendingDelete.set(null);
    this.toast.show(this.language.translate('contracts.toast.deleted', { number: item.number }), 'success');
  }

  // ---- Closing layers ----
  protected onDocumentClick(event: MouseEvent): void {
    if (this.rowMenu() && !(event.target as HTMLElement).closest('.row-menu')) this.rowMenu.set(null);
  }

  /** Esc closes the top-most layer only: a dialog first, then the row menu. */
  protected onEscape(): void {
    if (this.pendingComplete() || this.pendingDelete()) {
      this.pendingComplete.set(null);
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
