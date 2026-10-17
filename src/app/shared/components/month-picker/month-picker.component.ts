import { Component, ElementRef, computed, inject, input, model, signal } from '@angular/core';
import { LanguageService } from '../../../core/services/language.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { IconComponent } from '../icon/icon.component';

/** A calendar month: `month` is 0-based (0 = January), like Date#getMonth. */
export interface YearMonth {
  year: number;
  month: number;
}

/** The current month. */
export function currentYearMonth(): YearMonth {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

/** Months between two YearMonths (positive when `from` is later). */
export function monthsBetween(from: YearMonth, to: YearMonth): number {
  return from.year * 12 + from.month - (to.year * 12 + to.month);
}

/**
 * MonthPickerComponent
 * --------------------
 * Picks a month + year (no day). The button shows the selection
 * ("October 2026" / "أكتوبر 2026"); the panel has year arrows and a
 * 12-month grid. Months after `max` (default: this month) are disabled.
 *
 * @example <app-month-picker [(value)]="month" ariaLabel="procurement.month" />
 */
@Component({
  selector: 'app-month-picker',
  imports: [IconComponent, TranslatePipe],
  template: `
    <div class="position-relative">
      <button type="button" class="btn-fs trigger" (click)="toggle()" [attr.aria-expanded]="open()" aria-haspopup="dialog" [attr.aria-label]="ariaLabel() ? (ariaLabel() | translate) + ': ' + label() : null">
        <app-icon name="calendar" />
        {{ label() }}
        <app-icon name="chevron-down" class="chevron" />
      </button>

      @if (open()) {
        <div class="dropdown-menu show picker" role="dialog" [attr.aria-label]="ariaLabel() | translate">
          <div class="year-nav">
            <button type="button" class="nav-btn" (click)="viewYear.set(viewYear() - 1)" [disabled]="viewYear() <= minYear()" [attr.aria-label]="'common.previousYear' | translate">
              <app-icon name="chevron-left" />
            </button>
            <span class="year" aria-live="polite">{{ viewYear() }}</span>
            <button type="button" class="nav-btn" (click)="viewYear.set(viewYear() + 1)" [disabled]="viewYear() >= max().year" [attr.aria-label]="'common.nextYear' | translate">
              <app-icon name="chevron-right" />
            </button>
          </div>

          <div class="month-grid">
            @for (m of months(); track m.month) {
              <button type="button" class="month" [class.selected]="m.selected" [class.current]="m.current" [disabled]="m.disabled" [attr.aria-pressed]="m.selected" [attr.aria-label]="m.fullLabel" (click)="select(m.month)">
                {{ m.label }}
              </button>
            }
          </div>

          <button type="button" class="this-month" (click)="selectThisMonth()">{{ 'common.thisMonth' | translate }}</button>
        </div>
      }
    </div>
  `,
  styles: `
    .trigger {
      font-size: 0.75rem;
      white-space: nowrap;
    }
    .chevron {
      font-size: 0.625rem;
      color: var(--fs-text-muted);
    }
    .picker {
      position: absolute;
      top: calc(100% + 0.375rem);
      inset-inline-end: 0;
      width: 15rem;
      padding: 0.75rem;
      z-index: 1050;
    }
    .year-nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.5rem;
    }
    .year {
      color: var(--fs-text);
      font-size: 0.875rem;
      font-weight: 700;
    }
    .nav-btn {
      display: inline-grid;
      place-items: center;
      width: 1.75rem;
      height: 1.75rem;
      padding: 0;
      border: 0;
      border-radius: 0.375rem;
      background: none;
      color: var(--fs-text);

      &:hover:not(:disabled) {
        background: var(--fs-surface-2);
      }
      &:disabled {
        color: var(--fs-border);
      }
    }
    /* Arrows point the reading direction in RTL */
    :host-context([dir='rtl']) .nav-btn app-icon {
      display: inline-block;
      transform: scaleX(-1);
    }
    .month-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.25rem;
    }
    .month {
      padding: 0.45rem 0;
      border: 1px solid transparent;
      border-radius: 0.375rem;
      background: none;
      color: var(--fs-text);
      font-size: 0.75rem;
      font-weight: 500;

      &:hover:not(:disabled) {
        background: var(--fs-surface-2);
      }
      &.current {
        border-color: var(--fs-border);
      }
      &.selected {
        background: var(--fs-primary);
        border-color: var(--fs-primary);
        color: #fff;
      }
      &:disabled {
        color: var(--fs-text-muted);
        opacity: 0.45;
      }
    }
    .this-month {
      display: block;
      width: 100%;
      margin-top: 0.5rem;
      padding: 0.375rem 0 0;
      border: 0;
      border-top: 1px solid var(--fs-border);
      background: none;
      color: var(--fs-primary-text);
      font-size: 0.75rem;
      font-weight: 600;
    }
  `,
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'open.set(false)',
  },
})
export class MonthPickerComponent {
  private readonly language = inject(LanguageService);
  private readonly host = inject(ElementRef<HTMLElement>);

  /** Selected month (two-way bindable). */
  readonly value = model<YearMonth>(currentYearMonth());
  /** Latest selectable month. */
  readonly max = input<YearMonth>(currentYearMonth());
  /** Earliest selectable year. */
  readonly minYear = input(currentYearMonth().year - 10);
  /** Translation key naming the control, for screen readers. */
  readonly ariaLabel = input('');

  protected readonly open = signal(false);
  /** Year shown in the panel (can differ from the selected year while browsing). */
  protected readonly viewYear = signal(this.value().year);

  /** Button text, e.g. "October 2026". */
  protected readonly label = computed(() => {
    const { year, month } = this.value();
    return new Intl.DateTimeFormat(this.language.locale(), { month: 'long', year: 'numeric' }).format(new Date(year, month, 1));
  });

  /** The 12 months of the shown year. */
  protected readonly months = computed(() => {
    const locale = this.language.locale();
    const short = new Intl.DateTimeFormat(locale, { month: 'short' });
    const long = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });
    const year = this.viewYear();
    const value = this.value();
    const today = currentYearMonth();
    return Array.from({ length: 12 }, (_, month) => {
      const date = new Date(year, month, 1);
      return {
        month,
        label: short.format(date),
        fullLabel: long.format(date),
        selected: value.year === year && value.month === month,
        current: today.year === year && today.month === month,
        disabled: monthsBetween({ year, month }, this.max()) > 0 || year < this.minYear(),
      };
    });
  });

  protected toggle(): void {
    if (!this.open()) this.viewYear.set(this.value().year);
    this.open.set(!this.open());
  }

  protected select(month: number): void {
    this.value.set({ year: this.viewYear(), month });
    this.open.set(false);
  }

  protected selectThisMonth(): void {
    this.value.set(currentYearMonth());
    this.open.set(false);
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }
}
