import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ChartComponent } from '../../shared/components/chart/chart.component';
import { DashboardComponent } from './dashboard.component';
import { BudgetItemsComponent } from './widgets/budget-items/budget-items.component';
import { ProcurementStatusComponent } from './widgets/procurement-status/procurement-status.component';

@Component({ selector: 'app-chart', template: '' })
class ChartStub {
  readonly options = input<unknown>();
}

describe('DashboardComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    const noChart = { remove: { imports: [ChartComponent] }, add: { imports: [ChartStub] } };
    await TestBed.configureTestingModule({ imports: [DashboardComponent] })
      .overrideComponent(BudgetItemsComponent, noChart)
      .overrideComponent(ProcurementStatusComponent, noChart)
      .compileComponents();
  });

  it('renders the page heading, the stat cards and every widget', async () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('h1')?.textContent?.trim()).toBeTruthy();
    expect(el.querySelectorAll('.stat-card').length).toBe(5);
    for (const widget of [
      'app-my-tasks',
      'app-recent-activities',
      'app-procurement-status',
      'app-recent-transactions',
      'app-warehouses',
      'app-contracts',
      'app-budget-items',
    ]) {
      expect(el.querySelector(widget), widget).not.toBeNull();
    }
  });
});
