import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RecentActivitiesComponent } from './recent-activities.component';

describe('RecentActivitiesComponent', () => {
  let fixture: ComponentFixture<RecentActivitiesComponent>;
  let component: RecentActivitiesComponent;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [RecentActivitiesComponent] }).compileComponents();
    fixture = TestBed.createComponent(RecentActivitiesComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  const visibleCount = () => component['groups']().reduce((n, g) => n + g.items.length, 0);

  it('shows 5 activities by default, then all of them with "show all"', () => {
    expect(component['hasMore']()).toBe(true);
    expect(visibleCount()).toBe(5);

    component['showAll'].set(true);
    expect(visibleCount()).toBe(8);
  });

  it('groups items by day, starting with Today', () => {
    const labels = component['groups']().map((g) => g.label);
    expect(labels[0]).toBe('Today');
    expect(labels[1]).toBe('Yesterday');
    expect(new Set(labels).size).toBe(labels.length); // no duplicate headings
  });

  it('keeps items newest first (replies aside)', () => {
    component['showAll'].set(true);
    const dates = component['groups']().flatMap((g) => g.items.filter((i) => i.kind !== 'reply').map((i) => i.date));
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it('puts a reply right under the message it answers, without its own dot', async () => {
    const items = component['groups']().flatMap((g) => g.items);
    const reply = items.findIndex((i) => i.kind === 'reply');
    expect(reply).toBeGreaterThan(0);
    expect(items[reply - 1].id).toBe(items[reply].replyTo);

    const el: HTMLElement = fixture.nativeElement;
    const replyRow = el.querySelector('li.is-reply')!;
    expect(replyRow.querySelector('.dot')).toBeNull();
    expect(replyRow.querySelector('.reply-chip')).not.toBeNull();
  });

  it('the Today filter hides older activities', () => {
    component['period'].set('today');
    expect(component['groups']().map((g) => g.label)).toEqual(['Today']);
    expect(component['hasMore']()).toBe(false);
  });

  it('the Week filter drops activities older than 7 days', () => {
    component['period'].set('week');
    component['showAll'].set(true);
    expect(visibleCount()).toBe(6);
  });

  it('shows relative time within the last hour, clock time after', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(component['timeLabel'](fiveMinutesAgo)).toBe('5 minutes ago');

    const yesterday = new Date(Date.now() - 26 * 3_600_000).toISOString();
    expect(component['timeLabel'](yesterday)).toMatch(/\d{2}:\d{2}/);
  });
});
