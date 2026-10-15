import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RecentTransactionsComponent } from './recent-transactions.component';

describe('RecentTransactionsComponent', () => {
  let fixture: ComponentFixture<RecentTransactionsComponent>;
  let component: RecentTransactionsComponent;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [RecentTransactionsComponent] }).compileComponents();
    fixture = TestBed.createComponent(RecentTransactionsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  const ids = () => component['rows']().map((t) => t.id);

  it('renders the five transactions', () => {
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(5);
  });

  it('filters by type', () => {
    component['type'].set('custody');
    expect(ids()).toEqual([2]);
  });

  it('searches by employee name', () => {
    component['search'].set('jassim');
    expect(ids()).toEqual([3]);
  });

  it('sorts durations across units (days < weeks < months < years)', () => {
    component['sort'].toggle('duration');
    component['sort'].toggle('duration'); // descending
    expect(ids()).toEqual([5, 4, 3, 2, 1]);
  });

  it('formats the duration as a padded number with a translated unit', () => {
    const [first] = component['rows']();
    expect(component['duration'](first)).toMatch(/^01 \S+/);
  });
});
