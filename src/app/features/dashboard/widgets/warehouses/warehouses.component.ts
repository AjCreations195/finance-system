import { Component, computed, inject, signal } from '@angular/core';
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

/**
 * WarehousesComponent ("المستودعات")
 * --------------------------------
 * Stock levels per product. The "High / Low balances" toggle shows the
 * items with the most / least stock relative to their max order level.
 */
@Component({
  selector: 'app-warehouses',
  imports: [IconComponent, DashboardCardComponent, TranslatePipe, LocalizePipe],
  templateUrl: './warehouses.component.html',
})
export class WarehousesComponent {
  protected readonly data = inject(DashboardDataService);
  private readonly language = inject(LanguageService);
  private readonly toast = inject(ToastService);

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

  protected notAvailable(): void {
    this.toast.show(this.language.translate('login.featureNotAvailable'), 'info');
  }
}
