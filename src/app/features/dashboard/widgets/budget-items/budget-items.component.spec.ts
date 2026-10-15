import { Component, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LanguageService } from '../../../../core/services/language.service';
import { ChartComponent } from '../../../../shared/components/chart/chart.component';
import { BudgetItemsComponent } from './budget-items.component';

@Component({ selector: 'app-chart', template: '' })
class ChartStub {
  readonly options = input<unknown>();
}

describe('BudgetItemsComponent', () => {
  let fixture: ComponentFixture<BudgetItemsComponent>;
  let component: BudgetItemsComponent;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [BudgetItemsComponent] })
      .overrideComponent(BudgetItemsComponent, { remove: { imports: [ChartComponent] }, add: { imports: [ChartStub] } })
      .compileComponents();
    fixture = TestBed.createComponent(BudgetItemsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  const series = () => component['chartOptions']().series as { name: string; data: number[] }[];

  it('shows both stacked series by default', () => {
    expect(series().map((s) => s.name)).toEqual(['Spent', 'Remaining']);
    expect(series()[0].data.length).toBe(12);
  });

  it('the total adds up the visible series', () => {
    // 2025 design values: spent 359,000 + remaining 373,000
    expect(component['total']()).toBe('732,000.00');

    component['series'].set('spent');
    expect(component['total']()).toBe('359,000.00');
    expect(series().length).toBe(1);

    component['series'].set('remaining');
    expect(component['total']()).toBe('373,000.00');
  });

  it('changing the year reloads the data', () => {
    component['year'].set(2026);
    expect(series()[0].data[0]).toBe(Math.round(42_000 * 1.08));
  });

  it('in Arabic, January moves to the right and the value axis flips', () => {
    TestBed.inject(LanguageService).setLanguage('ar');
    const options = component['chartOptions']();
    expect(series()[0].data.at(-1)).toBe(42_000);
    expect((options.yaxis as { opposite: boolean }).opposite).toBe(true);
  });
});
