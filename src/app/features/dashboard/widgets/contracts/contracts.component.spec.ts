import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContractsComponent } from './contracts.component';

describe('ContractsComponent', () => {
  let fixture: ComponentFixture<ContractsComponent>;
  let component: ContractsComponent;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [ContractsComponent] }).compileComponents();
    fixture = TestBed.createComponent(ContractsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  const progress = () => component['rows']().map((c) => c.progress);

  it('renders all five contracts', () => {
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(5);
  });

  it.each([
    ['low', [25, 15]],
    ['mid', [55]],
    ['high', [85, 70]],
    ['all', [25, 55, 85, 15, 70]],
  ])('the "%s" progress range keeps %j', (range, expected) => {
    component['range'].set(range);
    expect(progress()).toEqual(expected);
  });

  it('searches by supplier name', () => {
    component['search'].set('ooredoo');
    expect(component['rows']().map((c) => c.id)).toEqual([2]);
  });

  it('sorts by progress', () => {
    component['sort'].toggle('progress');
    expect(progress()).toEqual([15, 25, 55, 70, 85]);
  });

  it('uses the first letter of the supplier as the logo', () => {
    expect(component['initial']('  Qatar Bank')).toBe('Q');
  });
});
