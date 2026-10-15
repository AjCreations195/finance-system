import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WarehousesComponent } from './warehouses.component';

describe('WarehousesComponent', () => {
  let fixture: ComponentFixture<WarehousesComponent>;
  let component: WarehousesComponent;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [WarehousesComponent] }).compileComponents();
    fixture = TestBed.createComponent(WarehousesComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  /** Stock fill ratio of each visible row. */
  const ratios = () => component['rows']().map((w) => w.quantity / w.maxLevel);

  it('shows at most 5 rows', () => {
    expect(component['rows']().length).toBe(5);
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(5);
  });

  it('"High" lists the fullest items first', () => {
    const r = ratios();
    expect(r).toEqual([...r].sort((a, b) => b - a));
    expect(component['rows']()[0].id).toBe(7); // coffee: 36 / 40
  });

  it('"Low" lists the emptiest items first', () => {
    component['view'].set('low');
    const r = ratios();
    expect(r).toEqual([...r].sort((a, b) => a - b));
    expect(component['rows']()[0].id).toBe(1); // sugar: 1 / 31
  });

  it('a column sort re-orders the visible rows', () => {
    component['sort'].toggle('quantity');
    const quantities = component['rows']().map((w) => w.quantity);
    expect(quantities).toEqual([...quantities].sort((a, b) => a - b));
  });
});
