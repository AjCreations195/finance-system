import { Component, inject } from '@angular/core';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { BudgetItemsComponent } from './widgets/budget-items/budget-items.component';
import { ContractsComponent } from './widgets/contracts/contracts.component';
import { MyTasksComponent } from './widgets/my-tasks/my-tasks.component';
import { ProcurementStatusComponent } from './widgets/procurement-status/procurement-status.component';
import { RecentActivitiesComponent } from './widgets/recent-activities/recent-activities.component';
import { RecentTransactionsComponent } from './widgets/recent-transactions/recent-transactions.component';
import { StatCarouselComponent } from '../../shared/components/stat-carousel/stat-carousel.component';
import { DashboardDataService } from '../../core/services/dashboard-data.service';
import { WarehousesComponent } from './widgets/warehouses/warehouses.component';

/**
 * DashboardComponent
 * ------------------
 * Main page after login. It only arranges the widgets on the Bootstrap
 * grid; each widget is a standalone component under ./widgets with its
 * own data, filters and comments.
 *
 * Layout (Figma), in reading order (right → left in Arabic):
 *   1. Financial statistic cards (carousel)        full width
 *   2. My tasks table                              full width
 *   3. Recent activities  | Procurement status     half width each
 *   4. Recent transactions| Warehouses             half width each
 *   5. Contracts          | Budget items chart     half width each
 *
 * Rows 4–5 hold tables; near the xl breakpoint a half-width card can be
 * narrower than the table, which then scrolls horizontally inside its card.
 */
@Component({
  selector: 'app-dashboard',
  imports: [
    TranslatePipe,
    StatCarouselComponent,
    MyTasksComponent,
    RecentActivitiesComponent,
    ProcurementStatusComponent,
    RecentTransactionsComponent,
    WarehousesComponent,
    ContractsComponent,
    BudgetItemsComponent,
  ],
  template: `
    <h1 class="visually-hidden">{{ 'dashboard.title' | translate }}</h1>

    <app-stat-carousel [stats]="data.stats()" />

    <div class="row g-3 g-xl-4">
      <div class="col-12"><app-my-tasks /></div>

      <div class="col-12 col-xl-6"><app-recent-activities /></div>
      <div class="col-12 col-xl-6"><app-procurement-status /></div>

      <div class="col-12 col-xl-6"><app-recent-transactions /></div>
      <div class="col-12 col-xl-6"><app-warehouses /></div>

      <div class="col-12 col-xl-6"><app-contracts /></div>
      <div class="col-12 col-xl-6"><app-budget-items /></div>
    </div>
  `,
})
export class DashboardComponent {
  protected readonly data = inject(DashboardDataService);
}
