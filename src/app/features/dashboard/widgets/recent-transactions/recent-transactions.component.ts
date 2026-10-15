import { Component, computed, inject, signal } from '@angular/core';
import { TRANSACTION_TYPES, TransactionItem } from '../../../../core/models/dashboard.models';
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

/**
 * RecentTransactionsComponent ("المعاملات الأخيرة")
 * -----------------------------------------------
 * Compact table with type filter, search and sorting.
 */
@Component({
  selector: 'app-recent-transactions',
  imports: [IconComponent, DashboardCardComponent, FilterMenuComponent, TranslatePipe, LocalizePipe],
  templateUrl: './recent-transactions.component.html',
})
export class RecentTransactionsComponent {
  protected readonly data = inject(DashboardDataService);
  private readonly language = inject(LanguageService);
  private readonly toast = inject(ToastService);

  protected readonly search = signal('');
  protected readonly type = signal('all');
  protected readonly sort = new TableSort<SortKey>();
  protected readonly columns: SortKey[] = ['number', 'type', 'employee', 'duration'];

  protected readonly typeOptions: FilterOption[] = [
    { value: 'all', label: 'common.all' },
    ...TRANSACTION_TYPES.map((t) => ({ value: t, label: `transactions.types.${t}` })),
  ];

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

  protected notAvailable(): void {
    this.toast.show(this.language.translate('login.featureNotAvailable'), 'info');
  }
}
