import { Component, computed, inject, signal } from '@angular/core';
import type ApexCharts from 'apexcharts';
import { DashboardDataService } from '../../../../core/services/dashboard-data.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { ChartComponent } from '../../../../shared/components/chart/chart.component';
import { DashboardCardComponent } from '../../../../shared/components/dashboard-card/dashboard-card.component';
import { FilterMenuComponent, FilterOption } from '../../../../shared/components/filter-menu/filter-menu.component';
import { SelectMenuComponent } from '../../../../shared/components/select-menu/select-menu.component';
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
  imports: [DashboardCardComponent, FilterMenuComponent, SelectMenuComponent, ChartComponent, TranslatePipe],
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
      font-size: 1rem;
      font-weight: 700;
    }
    .total {
      color: var(--fs-text-muted);
      font-size: 0.875rem;
    }
    .total strong {
      color: var(--fs-text);
      margin-inline-start: 0.375rem;
    }
    .chart-body {
      padding: 0 0.75rem;
    }
    /* Centres the year dropdown under the chart */
    .year-wrap {
      display: flex;
      justify-content: center;
      margin: 0 auto 1rem;
    }
  `,
})
export class BudgetItemsComponent {
  private readonly data = inject(DashboardDataService);
  private readonly language = inject(LanguageService);
  private readonly theme = inject(ThemeService);

  /** Years offered by the year selector. */
  protected readonly years = this.data.budgetYears;
  /** The year selector's options; the select menu works with strings, so the years are converted. */
  protected readonly yearOptions: FilterOption[] = this.years.map((y) => ({ value: String(y), label: String(y) }));
  /** Lets the template turn the numeric year into the select's string value. */
  protected readonly String = String;
  /** Selected year. */
  protected readonly year = signal(new Date().getFullYear());
  /** 'all' | 'spent' | 'remaining' */
  protected readonly series = signal('all');

  /** Options of the series filter (labels are translation keys). */
  protected readonly seriesOptions: FilterOption[] = [
    { value: 'all', label: 'common.all' },
    { value: 'spent', label: 'budget.spent' },
    { value: 'remaining', label: 'budget.remaining' },
  ];

  /** Spent and remaining amount for each month of the selected year. */
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

  /** ApexCharts options: the stacked bars for the visible series, with RTL and theme colours. */
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
        // Month names for the selected year (the names themselves don't change with the year).
        categories: ordered.map((m) => monthFmt.format(new Date(this.year(), m.month, 1))),
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
