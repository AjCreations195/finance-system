import { Component, computed, inject, signal } from '@angular/core';
import type ApexCharts from 'apexcharts';
import { DashboardDataService } from '../../../../core/services/dashboard-data.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { ChartComponent } from '../../../../shared/components/chart/chart.component';
import { DashboardCardComponent } from '../../../../shared/components/dashboard-card/dashboard-card.component';
import { FilterMenuComponent, FilterOption } from '../../../../shared/components/filter-menu/filter-menu.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

/** Bar colors from the design: light (bottom segment) and darker blue (top segment). */
const BAR_COLORS = { spent: '#c9dcf8', remaining: '#8db4f5' };
const BAR_COLORS_DARK = { spent: '#3e5c9a', remaining: '#8db4f5' };

/**
 * BudgetItemsComponent ("البنود")
 * ------------------------------
 * Stacked column chart of budget items per month (spent + remaining),
 * with a year selector and a series filter. The total in the header is
 * computed from whichever series are shown.
 *
 * In Arabic the month axis runs right-to-left (January on the right),
 * as in the design, by reversing the categories.
 */
@Component({
  selector: 'app-budget-items',
  imports: [DashboardCardComponent, FilterMenuComponent, ChartComponent, TranslatePipe],
  templateUrl: './budget-items.component.html',
  styles: `
    .chart-head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      padding: 0.875rem 1.25rem 0;
    }
    .chart-title {
      margin: 0;
      color: var(--fs-text);
      font-size: 0.875rem;
      font-weight: 700;
    }
    .total {
      color: var(--fs-text-muted);
      font-size: 0.75rem;
    }
    .total strong {
      color: var(--fs-text);
      margin-inline-start: 0.375rem;
    }
    .chart-body {
      padding: 0 0.75rem;
    }
    .year-select {
      width: auto;
      margin: 0 auto 1rem;
      border: 0;
      background-color: transparent;
      font-size: 0.75rem;
      font-weight: 600;
    }
  `,
})
export class BudgetItemsComponent {
  private readonly data = inject(DashboardDataService);
  private readonly language = inject(LanguageService);
  private readonly theme = inject(ThemeService);

  protected readonly years = this.data.budgetYears;
  protected readonly year = signal(2025);
  /** 'all' | 'spent' | 'remaining' */
  protected readonly series = signal('all');

  protected readonly seriesOptions: FilterOption[] = [
    { value: 'all', label: 'common.all' },
    { value: 'spent', label: 'budget.spent' },
    { value: 'remaining', label: 'budget.remaining' },
  ];

  private readonly months = computed(() => this.data.budgetItems(this.year()));

  /** Total of the visible series, e.g. 589,235.99 */
  protected readonly total = computed(() => {
    const s = this.series();
    const sum = this.months().reduce(
      (acc, m) => acc + (s !== 'remaining' ? m.spent : 0) + (s !== 'spent' ? m.remaining : 0),
      0,
    );
    return new Intl.NumberFormat(this.language.locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(sum);
  });

  protected readonly chartOptions = computed<ApexCharts.ApexOptions>(() => {
    const rtl = this.language.isRtl();
    const colors = this.theme.isDark() ? BAR_COLORS_DARK : BAR_COLORS;
    const monthFmt = new Intl.DateTimeFormat(this.language.locale(), { month: 'long' });
    const numberFmt = new Intl.NumberFormat(this.language.locale(), { notation: 'compact' });

    // Reverse for RTL so January sits on the right (the chart itself stays LTR).
    const ordered = rtl ? [...this.months()].reverse() : this.months();
    const s = this.series();
    const series: { name: string; data: number[] }[] = [];
    const seriesColors: string[] = [];
    if (s !== 'remaining') {
      series.push({ name: this.language.translate('budget.spent'), data: ordered.map((m) => m.spent) });
      seriesColors.push(colors.spent);
    }
    if (s !== 'spent') {
      series.push({ name: this.language.translate('budget.remaining'), data: ordered.map((m) => m.remaining) });
      seriesColors.push(colors.remaining);
    }

    return {
      chart: { type: 'bar', height: 300, stacked: true },
      series,
      colors: seriesColors,
      plotOptions: { bar: { columnWidth: '42%', borderRadius: 2 } },
      dataLabels: { enabled: false },
      legend: { show: false },
      xaxis: {
        categories: ordered.map((m) => monthFmt.format(new Date(2025, m.month, 1))),
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: { style: { fontSize: '10px' } },
      },
      yaxis: {
        opposite: rtl, // value axis on the right in Arabic
        labels: { formatter: (v: number) => numberFmt.format(v) },
      },
      tooltip: { y: { formatter: (v: number) => new Intl.NumberFormat(this.language.locale()).format(v) } },
    };
  });
}
