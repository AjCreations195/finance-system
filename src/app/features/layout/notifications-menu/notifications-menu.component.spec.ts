import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DashboardDataService } from '../../../core/services/dashboard-data.service';
import { ToastService } from '../../../core/services/toast.service';
import { NotificationsMenuComponent } from './notifications-menu.component';

describe('NotificationsMenuComponent', () => {
  let fixture: ComponentFixture<NotificationsMenuComponent>;
  let component: NotificationsMenuComponent;
  let el: HTMLElement;
  let data: DashboardDataService;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [NotificationsMenuComponent] }).compileComponents();
    fixture = TestBed.createComponent(NotificationsMenuComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    data = TestBed.inject(DashboardDataService);
    await fixture.whenStable();
  });

  const bell = () => el.querySelector<HTMLButtonElement>('button')!;
  const panel = () => el.querySelector('.notif-panel');

  async function openPanel(): Promise<void> {
    bell().click();
    await fixture.whenStable();
  }

  it('the bell opens and closes the panel', async () => {
    expect(panel()).toBeNull();
    await openPanel();
    expect(panel()).not.toBeNull();
    await openPanel();
    expect(panel()).toBeNull();
  });

  it('clicking outside closes the panel, clicking inside does not', async () => {
    await openPanel();
    panel()!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await fixture.whenStable();
    expect(panel()).not.toBeNull();

    document.body.click();
    await fixture.whenStable();
    expect(panel()).toBeNull();
  });

  it('the "unread" filter hides read notifications', () => {
    expect(component['items']().length).toBe(3);
    component['filter'].set('unread');
    expect(component['items']().every((n) => n.unread)).toBe(true);
    expect(component['items']().length).toBe(2);
  });

  it('"mark all read" clears the unread count', async () => {
    await openPanel();
    el.querySelector<HTMLButtonElement>('.mark-read')!.click();
    await fixture.whenStable();

    expect(data.unreadCount()).toBe(0);
    expect(el.querySelector<HTMLButtonElement>('.mark-read')!.disabled).toBe(true);
  });

  it('Approve / Reject remove the notification and show a success toast', () => {
    const toast = TestBed.inject(ToastService);

    component['act'](1, 'reject');
    expect(data.notifications().some((n) => n.id === 1)).toBe(false);
    expect(toast.toasts().at(-1)?.type).toBe('success');
    expect(toast.toasts().at(-1)?.message).toBe('The purchase request was rejected.');

    component['act'](2, 'approve');
    expect(data.notifications().some((n) => n.id === 2)).toBe(false);
    expect(toast.toasts().at(-1)?.type).toBe('success');
    expect(toast.toasts().at(-1)?.message).toBe('The purchase request was approved.');
  });

  it('shows times the way the design does: Today / Yesterday / date, with AM or PM', () => {
    const now = new Date();
    const at = (daysAgo: number, h: number, m: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, h, m).toISOString();
    expect(component['timeLabel'](at(0, 9, 42))).toBe('Today at 9:42 AM');
    expect(component['timeLabel'](at(1, 17, 42))).toBe('Yesterday at 5:42 PM');
    expect(component['timeLabel'](at(3, 0, 5))).toMatch(/ at 12:05 AM$/);
  });
});
