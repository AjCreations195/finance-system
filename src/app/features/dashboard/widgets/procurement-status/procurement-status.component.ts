import { Component, computed, inject, signal } from '@angular/core';
import type ApexCharts from 'apexcharts';
import { ProcurementState } from '../../../../core/models/dashboard.models';
import { DashboardDataService } from '../../../../core/services/dashboard-data.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ChartComponent } from '../../../../shared/components/chart/chart.component';
import { DashboardCardComponent } from '../../../../shared/components/dashboard-card/dashboard-card.component';
import { FilterOption } from '../../../../shared/components/filter-menu/filter-menu.component';
import { MultiFilterMenuComponent } from '../../../../shared/components/filter-menu/multi-filter-menu.component';
import { MonthPickerComponent, YearMonth, currentYearMonth, monthsBetween } from '../../../../shared/components/month-picker/month-picker.component';
import { SelectMenuComponent } from '../../../../shared/components/select-menu/select-menu.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { CountUpDirective } from '../../../../shared/directives/count-up.directive';

/** Icon per category, shown in the category dropdown. */
const CATEGORY_ICONS: Record<string, string> = {
  all: 'grid',
  itEquipment: 'computer',
  furniture: 'lamp',
  vehicles: 'truck',
  services: 'tools',
};

/** Donut segment colors, sampled from the design. */
const STATE_COLORS: Record<Exclude<ProcurementState, 'all'>, string> = {
  delivered: '#64bfe2',
  pending: '#b9cad6',
  new: '#dce6ec',
  cancelled: '#0d4261',
  shipping: '#3e7a9e',
};

/**
 * ProcurementStatusComponent ("حالة المشتريات")
 * -------------------------------------------
 * Donut chart of procurement transactions by state, with a 2-column
 * breakdown grid. The category dropdown and month picker re-query the
 * data; the header "Filter" chooses which states are shown. The chart,
 * the grid and the totals all follow.
 */
@Component({
  selector: 'app-procurement-status',
  imports: [IconComponent, DashboardCardComponent, MultiFilterMenuComponent, MonthPickerComponent, SelectMenuComponent, ChartComponent, TranslatePipe, CountUpDirective],
  templateUrl: './procurement-status.component.html',
  styleUrl: './procurement-status.component.scss',
})
export class ProcurementStatusComponent {
  private readonly data = inject(DashboardDataService);
  private readonly language = inject(LanguageService);

  protected readonly category = signal('all');
  /** Selected month (any month up to the current one). */
  protected readonly month = signal<YearMonth>(currentYearMonth());

  protected readonly categoryOptions: FilterOption[] = this.data.procurementCategories.map((c) => ({
    value: c,
    label: `procurement.categories.${c}`,
    icon: CATEGORY_ICONS[c],
  }));

  /** States offered by the header filter, in the data's order. */
  protected readonly stateOptions: FilterOption[] = this.data.procurementBreakdown('all', 0).map((b) => ({
    value: b.state,
    label: `procurement.states.${b.state}`,
    icon: b.icon,
  }));
  /** States currently shown (all by default). */
  protected readonly states = signal<string[]>(this.stateOptions.map((o) => o.value));

  /** Breakdown for the category + month, limited to the ticked states. */
  private readonly breakdown = computed(() => {
    const shown = this.states();
    return this.data
      .procurementBreakdown(this.category(), monthsBetween(currentYearMonth(), this.month()))
      .filter((b) => shown.includes(b.state));
  });
  protected readonly total = computed(() => this.breakdown().reduce((sum, b) => sum + b.count, 0));

  /** Grid order from the design: "all" goes second (new, all, shipping, …). */
  protected readonly gridItems = computed(() => {
    const items = [...this.breakdown()];
    items.splice(Math.min(1, items.length), 0, { state: 'all' as const, icon: 'grid', count: this.total() });
    return items;
  });

  /** The centre total is an HTML overlay (see the template), so it can count up. */
  protected readonly chartOptions = computed<ApexCharts.ApexOptions>(() => {
    const items = this.breakdown();
    return {
      chart: { type: 'donut', height: 260 },
      series: items.map((b) => b.count),
      labels: items.map((b) => this.language.translate(`procurement.states.${b.state}`)),
      colors: items.map((b) => STATE_COLORS[b.state as Exclude<ProcurementState, 'all'>]),
      legend: { show: false },
      dataLabels: { enabled: false },
      stroke: { width: 0 },
      plotOptions: {
        pie: {
          donut: {
            size: '58%',
            labels: { show: false },
          },
        },
      },
    };
  });
}
