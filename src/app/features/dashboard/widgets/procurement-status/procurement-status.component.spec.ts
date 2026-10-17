import { Component, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChartComponent } from '../../../../shared/components/chart/chart.component';
import { ProcurementStatusComponent } from './procurement-status.component';

/** Stands in for the ApexCharts wrapper, so the test checks options, not SVG. */
@Component({ selector: 'app-chart', template: '' })
class ChartStub {
  readonly options = input<unknown>();
}

describe('ProcurementStatusComponent', () => {
  let fixture: ComponentFixture<ProcurementStatusComponent>;
  let component: ProcurementStatusComponent;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [ProcurementStatusComponent] })
      .overrideComponent(ProcurementStatusComponent, { remove: { imports: [ChartComponent] }, add: { imports: [ChartStub] } })
      .compileComponents();
    fixture = TestBed.createComponent(ProcurementStatusComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('totals the breakdown (50 × 4 + 123 = 323)', () => {
    expect(component['total']()).toBe(323);
  });

  it('puts "all" second in the grid, as in the design', () => {
    const grid = component['gridItems']();
    expect(grid.map((g) => g.state)).toEqual(['new', 'all', 'shipping', 'pending', 'cancelled', 'delivered']);
    expect(grid[1].count).toBe(323);
  });

  it('passes one series value, label and color per state to the chart', () => {
    const options = component['chartOptions']();
    expect(options.series).toEqual([50, 50, 50, 50, 123]);
    expect(options.labels?.length).toBe(5);
    expect(options.colors?.length).toBe(5);
    // The centre total is an overlay (it counts up), so ApexCharts draws no label there
    expect(options.plotOptions?.pie?.donut?.labels?.show).toBe(false);
  });

  it('a category or month change updates the total', () => {
    component['category'].set('furniture');
    const furniture = component['total']();
    expect(furniture).toBeLessThan(323);

    const twoMonthsAgo = new Date();
    twoMonthsAgo.setDate(1);
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    component['month'].set({ year: twoMonthsAgo.getFullYear(), month: twoMonthsAgo.getMonth() });
    expect(component['total']()).toBeLessThan(furniture);
  });

  it('the status filter hides states from the chart, the grid and the totals', () => {
    component['states'].set(['new', 'pending', 'delivered']);
    expect(component['total']()).toBe(223); // 50 + 50 + 123
    expect(component['gridItems']().map((g) => g.state)).toEqual(['new', 'all', 'pending', 'delivered']);
    expect(component['chartOptions']().series).toEqual([50, 50, 123]);
    expect(component['chartOptions']().colors?.length).toBe(3);
  });

  it('puts "all" after the first shown state when "new" is hidden', () => {
    component['states'].set(['delivered']);
    expect(component['gridItems']().map((g) => g.state)).toEqual(['delivered', 'all']);
  });

  it('renders the month picker set to the current month', () => {
    const now = new Date();
    expect(component['month']()).toEqual({ year: now.getFullYear(), month: now.getMonth() });
    expect(fixture.nativeElement.querySelector('app-month-picker')).not.toBeNull();
  });
});
