import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DashboardDataService } from '../../../../core/services/dashboard-data.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { MyTasksComponent } from './my-tasks.component';

describe('MyTasksComponent', () => {
  let fixture: ComponentFixture<MyTasksComponent>;
  let component: MyTasksComponent;
  let el: HTMLElement;
  let data: DashboardDataService;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [MyTasksComponent] }).compileComponents();
    fixture = TestBed.createComponent(MyTasksComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    data = TestBed.inject(DashboardDataService);
    await fixture.whenStable();
  });

  const rows = () => component['rows']();

  it('shows 5 tasks per page (50 tasks → 10 pages)', () => {
    expect(el.querySelectorAll('tbody tr').length).toBe(5);
    expect(component['totalPages']()).toBe(10);
  });

  it('filters by status and goes back to page 1', () => {
    component['goTo'](4);
    component['onStatus']('review');
    expect(component['currentPage']()).toBe(1);
    expect(rows().every((t) => t.status === 'review')).toBe(true);
  });

  it('searches the task number', () => {
    component['onSearch']('BDRS/2026/BR/8010');
    expect(rows().map((t) => t.id)).toEqual([3]);
  });

  it('searches descriptions in the active language', () => {
    TestBed.inject(LanguageService).setLanguage('ar');
    component['onSearch']('تراخيص');
    expect(rows().length).toBeGreaterThan(0);
    expect(rows().every((t) => t.description.ar.includes('تراخيص'))).toBe(true);
  });

  it('sorts by attachments descending', () => {
    component['sort'].toggle('attachments');
    component['sort'].toggle('attachments');
    expect(rows()[0].attachments).toBe(5);
  });

  it('select all toggles every row on the current page', () => {
    component['toggleAllOnPage']();
    expect(component['selected']().size).toBe(5);
    expect(component['allOnPageSelected']()).toBe(true);

    component['toggleRow'](rows()[0].id);
    expect(component['allOnPageSelected']()).toBe(false);
  });

  it('approve marks the task completed and shows a success toast', async () => {
    const toast = TestBed.inject(ToastService);
    el.querySelector<HTMLButtonElement>('tbody tr:nth-child(2) button[aria-label="Approve"]')!.click();
    await fixture.whenStable();

    expect(data.tasks()[1].status).toBe('completed');
    expect(toast.toasts().at(-1)?.type).toBe('success');
  });

  it('disables Approve on a task that is already completed', () => {
    // Task 1 is seeded as 'completed'
    expect(el.querySelector<HTMLButtonElement>('tbody tr:nth-child(1) button[aria-label="Approve"]')!.disabled).toBe(true);
  });

  it('return sends the task back for review', () => {
    component['returnTask'](data.tasks()[0]);
    expect(data.tasks()[0].status).toBe('review');
  });

  it('pads numbers to two digits', () => {
    expect(component['pad'](1)).toBe('01');
    expect(component['pad'](12)).toBe('12');
  });
});
