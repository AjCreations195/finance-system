import { Component, computed, inject, signal } from '@angular/core';
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

/**
 * ContractsComponent ("العقود")
 * ----------------------------
 * Contracts with supplier logo, date and a completion progress bar.
 * The filter narrows by progress range (just started / in progress / almost done).
 */
@Component({
  selector: 'app-contracts',
  imports: [IconComponent, DashboardCardComponent, FilterMenuComponent, TranslatePipe, LocalizePipe, LocalDatePipe],
  templateUrl: './contracts.component.html',
  styles: `
    .supplier-logo {
      display: inline-grid;
      place-items: center;
      flex-shrink: 0;
      width: 1.5rem; /* same 24px as the logo images */
      height: 1.5rem;
      border-radius: 50%;
      color: #fff;
      font-size: 0.6875rem;
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
}
