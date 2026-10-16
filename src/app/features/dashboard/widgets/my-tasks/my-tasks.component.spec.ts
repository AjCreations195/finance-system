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

  // ---- Reject ----
  const rowButton = (row: number, label: string) => el.querySelector<HTMLButtonElement>(`tbody tr:nth-child(${row}) button[aria-label="${label}"]`)!;
  const click = async (target: HTMLElement) => {
    target.click();
    await fixture.whenStable();
  };

  it('reject asks for confirmation, then marks the task rejected', async () => {
    await click(rowButton(2, 'Reject'));
    const dialog = el.querySelector('.confirm-modal[role="alertdialog"]')!;
    expect(dialog.textContent).toContain('BDRS/2026/BR/8009');
    expect(data.tasks()[1].status).not.toBe('rejected');

    await click(dialog.querySelector<HTMLButtonElement>('.btn-danger')!);
    expect(data.tasks()[1].status).toBe('rejected');
    expect(el.querySelector('.confirm-modal')).toBeNull();
    expect(rowButton(2, 'Reject').disabled).toBe(true);
  });

  it('cancelling the reject dialog leaves the task unchanged', async () => {
    await click(rowButton(2, 'Reject'));
    await click(el.querySelector<HTMLButtonElement>('.confirm-modal .btn-fs')!);
    expect(data.tasks()[1].status).toBe('inProgress');
  });

  it('the status filter offers Rejected', () => {
    expect(component['statusOptions'].map((o) => o.value)).toContain('rejected');
  });

  it('Esc closes the reject dialog without changing the task', async () => {
    await click(rowButton(2, 'Reject'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
    expect(el.querySelector('.confirm-modal')).toBeNull();
    expect(data.tasks()[1].status).toBe('inProgress');
  });

  // ---- View / task number: module outside this task ----
  it('View and the task number show the "not available" toast', async () => {
    const toast = TestBed.inject(ToastService);
    await click(rowButton(1, 'View'));
    expect(toast.toasts().at(-1)?.type).toBe('info');

    const before = toast.toasts().length;
    await click(el.querySelector<HTMLElement>('tbody tr:nth-child(3) .ref-link')!);
    expect(toast.toasts().length).toBe(before + 1);
  });

  // ---- Row menu ----
  const menuItem = (label: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('.row-menu [role="menuitem"]')).find((b) => b.textContent!.includes(label))!;

  it('⋮ opens the row menu; an outside click closes it', async () => {
    await click(rowButton(1, 'More options'));
    expect(rowButton(1, 'More options').getAttribute('aria-expanded')).toBe('true');
    // 3 always + 4 phone-only (Approve, Return, Reject, View: hidden from md up by CSS)
    expect(el.querySelectorAll('.row-menu [role="menuitem"]').length).toBe(7);
    expect(el.querySelectorAll('.row-menu li.d-md-none [role="menuitem"]').length).toBe(4);

    await click(document.body);
    expect(el.querySelector('.row-menu')).toBeNull();
  });

  it('phone menu items act on the task and close the menu', async () => {
    await click(rowButton(2, 'More options'));
    expect(menuItem('Approve').disabled).toBe(false);
    await click(menuItem('Approve'));
    expect(data.tasks()[1].status).toBe('completed');
    expect(el.querySelector('.row-menu')).toBeNull();

    await click(rowButton(2, 'More options'));
    expect(menuItem('Approve').disabled).toBe(true);
    await click(menuItem('Reject'));
    expect(el.querySelector('.confirm-modal')).not.toBeNull();
  });

  it('on phones the row shows only ⋮ (the other buttons are md+ only)', () => {
    const buttons = Array.from(el.querySelectorAll<HTMLButtonElement>('tbody tr:nth-child(1) .row-actions button'));
    expect(buttons.filter((b) => b.classList.contains('d-none')).map((b) => b.getAttribute('aria-label'))).toEqual(['Approve', 'Return', 'Reject', 'View']);
    expect(el.querySelector('tbody tr:nth-child(1) td.actions-col')).not.toBeNull();
  });

  it('row menu → Copy task number copies it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await click(rowButton(1, 'More options'));
    await click(menuItem('Copy task number'));
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith('BDRS/2026/BR/8008');
    expect(TestBed.inject(ToastService).toasts().at(-1)?.type).toBe('success');
  });

  it('row menu → Mark as in progress (disabled when it already is)', async () => {
    await click(rowButton(1, 'More options'));
    await click(menuItem('Mark as in progress'));
    expect(data.tasks()[0].status).toBe('inProgress');

    await click(rowButton(1, 'More options'));
    expect(menuItem('Mark as in progress').disabled).toBe(true);
  });

  it('row menu → Delete asks for confirmation, then removes the task', async () => {
    component['toggleRow'](1);
    await click(rowButton(1, 'More options'));
    await click(menuItem('Delete task'));
    expect(data.tasks().length).toBe(50);

    await click(el.querySelector<HTMLButtonElement>('.confirm-modal .btn-danger')!);
    expect(data.tasks().length).toBe(49);
    expect(data.tasks().some((t) => t.id === 1)).toBe(false);
    expect(component['selected']().has(1)).toBe(false);
  });

  it('pads numbers to two digits', () => {
    expect(component['pad'](1)).toBe('01');
    expect(component['pad'](12)).toBe('12');
  });
});
