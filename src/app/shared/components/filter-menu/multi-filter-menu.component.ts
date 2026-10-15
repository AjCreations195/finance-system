import { Component, ElementRef, computed, inject, input, model, signal } from '@angular/core';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { FilterOption } from './filter-menu.component';
import { IconComponent } from '../icon/icon.component';

/**
 * MultiFilterMenuComponent
 * ------------------------
 * The design's "Filter" button, opening a checklist so several options can
 * be shown at once. Two-way binds the ticked values:
 *   <app-multi-filter-menu [options]="…" [(value)]="states" />
 * The button is highlighted while some options are unticked. At least one
 * option always stays ticked (the last one can't be unticked).
 */
@Component({
  selector: 'app-multi-filter-menu',
  imports: [IconComponent, TranslatePipe],
  template: `
    <div class="position-relative">
      <button type="button" class="btn-fs" [class.active]="active()" (click)="open.set(!open())" [attr.aria-expanded]="open()" aria-haspopup="true">
        <app-icon name="filter" class="filter-icon" />
        {{ 'common.filter' | translate }}
        @if (active()) {
          <span class="count">{{ value().length }}/{{ options().length }}</span>
        }
      </button>
      @if (open()) {
        <div class="dropdown-menu show filter-dropdown">
          <fieldset>
            @if (legend()) {
              <legend class="legend">{{ legend() | translate }}</legend>
            }
            @for (opt of options(); track opt.value) {
              <label class="dropdown-item option">
                <input type="checkbox" class="form-check-input m-0" [checked]="isChecked(opt.value)" [disabled]="isChecked(opt.value) && value().length === 1" (change)="toggle(opt.value)" />
                @if (opt.icon) {
                  <app-icon [name]="opt.icon" class="option-icon" />
                }
                {{ opt.label | translate }}
              </label>
            }
          </fieldset>
          <button type="button" class="select-all" [disabled]="!active()" (click)="selectAll()">{{ 'common.selectAll' | translate }}</button>
        </div>
      }
    </div>
  `,
  styles: `
    .count {
      padding: 0 0.375rem;
      border-radius: 999px;
      background: var(--fs-primary);
      color: #fff;
      font-size: 0.6875rem;
    }
    .filter-dropdown {
      position: absolute;
      top: calc(100% + 0.375rem);
      inset-inline-end: 0;
      min-width: 13rem;
      padding: 0.375rem;
      font-size: 0.8125rem;
      z-index: 1050;
    }
    fieldset {
      margin: 0;
      padding: 0;
      border: 0;
    }
    .legend {
      float: none;
      margin: 0;
      padding: 0.25rem 0.625rem 0.375rem;
      color: var(--fs-text-muted);
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    .option {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.45rem 0.625rem;
      border-radius: 0.375rem;
      cursor: pointer;
    }
    .option-icon {
      color: var(--fs-navy);
    }
    .select-all {
      display: block;
      width: 100%;
      margin-top: 0.25rem;
      padding: 0.5rem 0.625rem 0.25rem;
      border: 0;
      border-top: 1px solid var(--fs-border);
      background: none;
      color: var(--fs-primary);
      font-size: 0.75rem;
      font-weight: 600;
      text-align: start;

      &:disabled {
        color: var(--fs-text-muted);
        opacity: 0.6;
      }
    }
  `,
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'open.set(false)',
  },
})
export class MultiFilterMenuComponent {
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  readonly options = input.required<FilterOption[]>();
  /** Ticked values (two-way bindable). */
  readonly value = model.required<string[]>();
  /** Optional translation key shown as the list heading. */
  readonly legend = input('');

  protected readonly open = signal(false);
  /** A filter is applied when not every option is ticked. */
  protected readonly active = computed(() => this.value().length < this.options().length);

  protected isChecked(value: string): boolean {
    return this.value().includes(value);
  }

  /** Ticks/unticks one option, keeping the options' original order. */
  protected toggle(value: string): void {
    const next = this.isChecked(value) ? this.value().filter((v) => v !== value) : [...this.value(), value];
    if (!next.length) return;
    this.value.set(this.options().map((o) => o.value).filter((v) => next.includes(v)));
  }

  protected selectAll(): void {
    this.value.set(this.options().map((o) => o.value));
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }
}
