import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FinancialStat } from '../../core/models/dashboard.models';
import { LanguageService } from '../../core/services/language.service';
import { ThemeService } from '../../core/services/theme.service';
import { ToastService } from '../../core/services/toast.service';
import { DashboardCardComponent } from './dashboard-card/dashboard-card.component';
import { FilterMenuComponent, FilterOption } from './filter-menu/filter-menu.component';
import { LanguageSwitcherComponent } from './language-switcher/language-switcher.component';
import { MonthPickerComponent, YearMonth, monthsBetween } from './month-picker/month-picker.component';
import { SelectMenuComponent } from './select-menu/select-menu.component';
import { MultiFilterMenuComponent } from './filter-menu/multi-filter-menu.component';
import { StatCarouselComponent } from './stat-carousel/stat-carousel.component';
import { ThemeToggleComponent } from './theme-toggle/theme-toggle.component';
import { ToastContainerComponent } from './toast-container/toast-container.component';

beforeEach(() => localStorage.clear());

describe('ThemeToggleComponent', () => {
  it('toggles the theme and swaps the moon/sun icon', async () => {
    const fixture = TestBed.createComponent(ThemeToggleComponent);
    const theme = TestBed.inject(ThemeService);
    theme.setTheme('light');
    await fixture.whenStable();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(button.querySelector('app-icon')!.getAttribute('style')).toContain('icons/moon.svg');

    button.click();
    await fixture.whenStable();
    expect(theme.theme()).toBe('dark');
    expect(button.querySelector('app-icon')!.getAttribute('style')).toContain('icons/sun.svg');
  });
});

describe('LanguageSwitcherComponent', () => {
  const options = (el: HTMLElement) => Array.from(el.querySelectorAll<HTMLButtonElement>('.lang-option'));

  it('shows EN and Ar with the current language pressed', async () => {
    const fixture = TestBed.createComponent(LanguageSwitcherComponent);
    await fixture.whenStable();
    const [en, ar] = options(fixture.nativeElement);
    expect(en.textContent!.trim()).toBe('EN');
    expect(ar.textContent!.trim()).toBe('AR');
    expect(en.getAttribute('aria-pressed')).toBe('true');
    expect(ar.getAttribute('aria-pressed')).toBe('false');
    expect(ar.getAttribute('aria-label')).toBe('العربية');
  });

  it('switches language when the other option is clicked', async () => {
    const fixture = TestBed.createComponent(LanguageSwitcherComponent);
    await fixture.whenStable();
    options(fixture.nativeElement)[1].click();
    await fixture.whenStable();
    expect(TestBed.inject(LanguageService).lang()).toBe('ar');
    expect(options(fixture.nativeElement)[1].classList).toContain('active');

    options(fixture.nativeElement)[1].click(); // clicking the current one keeps it
    expect(TestBed.inject(LanguageService).lang()).toBe('ar');
  });

  it('keeps EN before Ar in both directions and has a compact size', async () => {
    const fixture = TestBed.createComponent(LanguageSwitcherComponent);
    fixture.componentRef.setInput('compact', true);
    await fixture.whenStable();
    const group: HTMLElement = fixture.nativeElement.querySelector('.lang-toggle');
    expect(group.getAttribute('dir')).toBe('ltr');
    expect(group.classList).toContain('compact');
  });
});

describe('ToastContainerComponent', () => {
  it('renders queued toasts and dismisses one with its close button', async () => {
    const fixture = TestBed.createComponent(ToastContainerComponent);
    const toasts = TestBed.inject(ToastService);
    toasts.show('Saved', 'success');
    toasts.show('Removed', 'danger');
    await fixture.whenStable();

    const el: HTMLElement = fixture.nativeElement;
    const items = el.querySelectorAll('[role="status"]');
    expect(items.length).toBe(2);
    expect(items[1].classList).toContain('fs-toast-danger');
    expect(items[1].querySelector('[data-icon="x-circle-fill"]')).not.toBeNull();

    el.querySelector<HTMLButtonElement>('.btn-close')!.click();
    await fixture.whenStable();
    expect(el.querySelectorAll('[role="status"]').length).toBe(1);
    expect(el.textContent).toContain('Removed');
  });

  it('shows a warning toast with its own color class and icon', async () => {
    const fixture = TestBed.createComponent(ToastContainerComponent);
    TestBed.inject(ToastService).show('Select something', 'warning');
    await fixture.whenStable();
    const toast = fixture.nativeElement.querySelector('[role="status"]');
    expect(toast.classList).toContain('fs-toast-warning');
    expect(toast.querySelector('[data-icon="warning-fill"]')).not.toBeNull();
  });

  it('is an aria-live region so screen readers announce toasts', () => {
    const fixture = TestBed.createComponent(ToastContainerComponent);
    expect(fixture.nativeElement.querySelector('[aria-live="polite"]')).not.toBeNull();
  });
});

describe('FilterMenuComponent', () => {
  @Component({
    imports: [FilterMenuComponent],
    template: `<p class="outside">outside</p><app-filter-menu [options]="options" [(value)]="value" />`,
  })
  class Host {
    options: FilterOption[] = [
      { value: 'all', label: 'common.all' },
      { value: 'open', label: 'Open' },
    ];
    value = signal('all');
  }

  it('opens, selects an option (two-way bound) and closes', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    const toggle = el.querySelector<HTMLButtonElement>('app-filter-menu button')!;

    toggle.click();
    await fixture.whenStable();
    const options = el.querySelectorAll<HTMLButtonElement>('[role="option"]');
    expect(options.length).toBe(2);

    options[1].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.value()).toBe('open');
    expect(el.querySelector('[role="listbox"]')).toBeNull();
    expect(toggle.classList).toContain('active'); // a filter is applied
  });

  it('closes when clicking outside', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    el.querySelector<HTMLButtonElement>('app-filter-menu button')!.click();
    await fixture.whenStable();

    el.querySelector<HTMLElement>('.outside')!.click();
    await fixture.whenStable();
    expect(el.querySelector('[role="listbox"]')).toBeNull();
  });
});

describe('DashboardCardComponent', () => {
  afterEach(() => document.body.classList.remove('overflow-hidden'));

  it('shows the translated title and projects content', async () => {
    @Component({
      imports: [DashboardCardComponent],
      template: `<app-dashboard-card title="common.filter"><div card-actions class="act">A</div><p class="body">B</p></app-dashboard-card>`,
    })
    class Host {}

    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('h2')!.textContent).toBe('Filter');
    expect(el.querySelector('.card-actions .act')).not.toBeNull();
    expect(el.querySelector('.dash-card-body .body')).not.toBeNull();
  });

  it('expands to full screen and locks scrolling until Escape', async () => {
    const fixture = TestBed.createComponent(DashboardCardComponent);
    fixture.componentRef.setInput('title', 'common.filter');
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;

    el.querySelector<HTMLButtonElement>('.expand-btn')!.click();
    await fixture.whenStable();
    expect(el.querySelector('.dash-card')!.classList).toContain('expanded');
    expect(document.body.classList).toContain('overflow-hidden');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
    expect(el.querySelector('.dash-card')!.classList).not.toContain('expanded');
    expect(document.body.classList).not.toContain('overflow-hidden');
  });

  it('gives each card a unique heading id for aria-labelledby', async () => {
    const a = TestBed.createComponent(DashboardCardComponent);
    const b = TestBed.createComponent(DashboardCardComponent);
    for (const f of [a, b]) f.componentRef.setInput('title', 'common.filter');
    await Promise.all([a.whenStable(), b.whenStable()]);
    expect(a.nativeElement.querySelector('h2').id).not.toBe(b.nativeElement.querySelector('h2').id);
  });
});

describe('StatCarouselComponent', () => {
  const stats: FinancialStat[] = [
    { id: 'a', label: 'common.filter', amount: 50_000_000, icon: 'stat-document', change: 26, higherIsBetter: false, period: 'common.today' },
    { id: 'b', label: 'common.filter', amount: 5_000_000, icon: 'stat-document', change: -15, higherIsBetter: true, period: 'common.today', trendStyle: 'pill' },
  ];

  async function create() {
    const fixture = TestBed.createComponent(StatCarouselComponent);
    fixture.componentRef.setInput('stats', stats);
    await fixture.whenStable();
    return fixture;
  }

  it('renders one card per stat with a compact amount', async () => {
    const fixture = await create();
    const cards = fixture.nativeElement.querySelectorAll('.stat-card');
    expect(cards.length).toBe(2);
    expect(cards[0].querySelector('.stat-value').textContent).toBe('50 million riyals');
  });

  it('colors a trend by whether the change is good news', async () => {
    const fixture = await create();
    const trends = fixture.nativeElement.querySelectorAll('.trend');
    expect(trends[0].classList).toContain('bad'); // +26% on a "lower is better" figure
    expect(trends[1].classList).toContain('bad'); // −15% on a "higher is better" figure
    expect(trends[1].classList).toContain('pill');
    expect(trends[1].textContent).toContain('−15%');
  });

  it('the arrows scroll by one card, flipped in RTL', async () => {
    const fixture = await create();
    const track: HTMLElement = fixture.nativeElement.querySelector('.track');
    track.scrollBy = vi.fn();

    fixture.nativeElement.querySelector('.nav-arrow.next').click();
    const ltrLeft = vi.mocked(track.scrollBy).mock.calls[0][0] as ScrollToOptions;
    expect(ltrLeft.left).toBeGreaterThan(0);

    TestBed.inject(LanguageService).setLanguage('ar');
    fixture.nativeElement.querySelector('.nav-arrow.next').click();
    const rtlLeft = vi.mocked(track.scrollBy).mock.calls[1][0] as ScrollToOptions;
    expect(rtlLeft.left).toBeLessThan(0);
  });
});

describe('MonthPickerComponent', () => {
  @Component({
    imports: [MonthPickerComponent],
    template: `<p class="outside">outside</p><app-month-picker [(value)]="value" [max]="max" [minYear]="2020" />`,
  })
  class Host {
    value = signal<YearMonth>({ year: 2026, month: 9 });
    max: YearMonth = { year: 2026, month: 9 };
  }

  async function openPicker() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    el.querySelector<HTMLButtonElement>('.trigger')!.click();
    await fixture.whenStable();
    return { fixture, el, months: () => el.querySelectorAll<HTMLButtonElement>('.month') };
  }

  it('shows the selected month and year on the button', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.trigger').textContent).toContain('October 2026');
  });

  it('picks a month in an earlier year (two-way bound) and closes', async () => {
    const { fixture, el, months } = await openPicker();
    expect(months().length).toBe(12);
    expect(months()[9].getAttribute('aria-pressed')).toBe('true');

    el.querySelector<HTMLButtonElement>('[aria-label="Previous year"]')!.click();
    await fixture.whenStable();
    expect(el.querySelector('.year')!.textContent).toBe('2025');

    months()[2].click(); // March
    await fixture.whenStable();
    expect(fixture.componentInstance.value()).toEqual({ year: 2025, month: 2 });
    expect(el.querySelector('.picker')).toBeNull();
  });

  it('disables months after max and stops the year arrows at the limits', async () => {
    const { fixture, el, months } = await openPicker();
    expect(months()[9].disabled).toBe(false);
    expect(months()[10].disabled).toBe(true);
    expect(el.querySelector<HTMLButtonElement>('[aria-label="Next year"]')!.disabled).toBe(true);

    fixture.componentInstance.value.set({ year: 2020, month: 0 });
    await fixture.whenStable();
    el.querySelector<HTMLButtonElement>('.trigger')!.click(); // close
    el.querySelector<HTMLButtonElement>('.trigger')!.click(); // reopen on 2020
    await fixture.whenStable();
    expect(el.querySelector<HTMLButtonElement>('[aria-label="Previous year"]')!.disabled).toBe(true);
  });

  it('closes when clicking outside', async () => {
    const { fixture, el } = await openPicker();
    el.querySelector<HTMLElement>('.outside')!.click();
    await fixture.whenStable();
    expect(el.querySelector('.picker')).toBeNull();
  });

  it('counts months between two months', () => {
    expect(monthsBetween({ year: 2026, month: 1 }, { year: 2025, month: 11 })).toBe(2);
    expect(monthsBetween({ year: 2026, month: 1 }, { year: 2026, month: 1 })).toBe(0);
  });
});

describe('SelectMenuComponent', () => {
  @Component({
    imports: [SelectMenuComponent],
    template: `<p class="outside">outside</p><app-select-menu [options]="options" [(value)]="value" ariaLabel="common.filter" />`,
  })
  class Host {
    options: FilterOption[] = [
      { value: 'all', label: 'common.all', icon: 'grid' },
      { value: 'a', label: 'Alpha', icon: 'lamp' },
      { value: 'b', label: 'Beta' },
    ];
    value = signal('all');
  }

  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    const trigger = el.querySelector<HTMLButtonElement>('.trigger')!;
    const options = () => el.querySelectorAll<HTMLButtonElement>('[role="option"]');
    return { fixture, el, trigger, options };
  }

  it('shows the selected option with its icon on the button', async () => {
    const { trigger } = await setup();
    expect(trigger.textContent).toContain('All');
    expect(trigger.querySelector('[data-icon="grid"]')).not.toBeNull();
    expect(trigger.getAttribute('aria-label')).toBe('Filter: All');
  });

  it('Esc closes only the list, without reaching a panel around it', async () => {
    const { fixture, el, trigger } = await setup();
    const outerEsc = vi.fn();
    document.addEventListener('keydown', outerEsc);
    trigger.click();
    await fixture.whenStable();

    el.querySelector('[role="listbox"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    document.removeEventListener('keydown', outerEsc);

    expect(el.querySelector('[role="listbox"]')).toBeNull();
    expect(outerEsc).not.toHaveBeenCalled();
  });

  it('has a borderless text look and can open toward the inline end', async () => {
    const fixture = TestBed.createComponent(SelectMenuComponent);
    fixture.componentRef.setInput('options', [{ value: 'all', label: 'common.all' }]);
    fixture.componentRef.setInput('value', 'all');
    fixture.componentRef.setInput('appearance', 'text');
    fixture.componentRef.setInput('align', 'start');
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    const trigger = el.querySelector<HTMLButtonElement>('.trigger')!;
    expect(trigger.classList).toContain('text-trigger');
    expect(trigger.classList).not.toContain('btn-fs');

    trigger.click();
    await fixture.whenStable();
    expect(el.querySelector('.menu')!.classList).toContain('align-start');
  });

  it('selects an option (two-way bound), closes and returns focus to the button', async () => {
    const { fixture, el, trigger, options } = await setup();
    trigger.click();
    await fixture.whenStable();
    expect(options().length).toBe(3);
    expect(options()[0].getAttribute('aria-selected')).toBe('true');

    options()[1].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.value()).toBe('a');
    expect(el.querySelector('[role="listbox"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(trigger.textContent).toContain('Alpha');
  });

  it('moves focus with the arrow keys and closes on Escape', async () => {
    const { fixture, el, trigger, options } = await setup();
    trigger.click();
    await fixture.whenStable();
    expect(document.activeElement).toBe(options()[0]); // opens on the selected option

    const list = el.querySelector('[role="listbox"]')!;
    list.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(options()[1]);
    list.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(document.activeElement).toBe(options()[2]);

    list.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(el.querySelector('[role="listbox"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(fixture.componentInstance.value()).toBe('all'); // unchanged
  });

  it('closes when clicking outside', async () => {
    const { fixture, el, trigger } = await setup();
    trigger.click();
    await fixture.whenStable();
    el.querySelector<HTMLElement>('.outside')!.click();
    await fixture.whenStable();
    expect(el.querySelector('[role="listbox"]')).toBeNull();
  });
});

describe('MultiFilterMenuComponent', () => {
  @Component({
    imports: [MultiFilterMenuComponent],
    template: `<p class="outside">outside</p><app-multi-filter-menu [options]="options" [(value)]="value" legend="common.filter" />`,
  })
  class Host {
    options: FilterOption[] = [
      { value: 'a', label: 'Alpha' },
      { value: 'b', label: 'Beta' },
      { value: 'c', label: 'Gamma' },
    ];
    value = signal(['a', 'b', 'c']);
  }

  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    const button = el.querySelector<HTMLButtonElement>('app-multi-filter-menu button')!;
    button.click();
    await fixture.whenStable();
    const boxes = () => el.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    return { fixture, el, button, boxes };
  }

  it('starts with everything ticked and the button not highlighted', async () => {
    const { button, boxes } = await setup();
    expect(Array.from(boxes()).every((b) => b.checked)).toBe(true);
    expect(button.classList).not.toContain('active');
  });

  it('unticking keeps the menu open, highlights the button and shows the count', async () => {
    const { fixture, el, button, boxes } = await setup();
    boxes()[1].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.value()).toEqual(['a', 'c']);
    expect(button.classList).toContain('active');
    expect(button.textContent).toContain('2/3');
    expect(el.querySelector('.filter-dropdown')).not.toBeNull();

    boxes()[1].click(); // re-tick: original order is kept
    await fixture.whenStable();
    expect(fixture.componentInstance.value()).toEqual(['a', 'b', 'c']);
  });

  it('never lets the last ticked option be unticked', async () => {
    const { fixture, boxes } = await setup();
    fixture.componentInstance.value.set(['b']);
    await fixture.whenStable();
    expect(boxes()[1].disabled).toBe(true);
    expect(boxes()[0].disabled).toBe(false);
  });

  it('"Select all" ticks everything again', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.value.set(['a']);
    await fixture.whenStable();
    el.querySelector<HTMLButtonElement>('.select-all')!.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.value()).toEqual(['a', 'b', 'c']);
  });

  it('closes when clicking outside', async () => {
    const { fixture, el } = await setup();
    el.querySelector<HTMLElement>('.outside')!.click();
    await fixture.whenStable();
    expect(el.querySelector('.filter-dropdown')).toBeNull();
  });
});
