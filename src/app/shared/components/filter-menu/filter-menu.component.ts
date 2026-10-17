import { Component, ElementRef, inject, input, model, signal } from '@angular/core';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { IconComponent } from '../icon/icon.component';

/** One option in the filter dropdown. `label` is a translation key; `icon` is an optional SVG name (public/icons). */
export interface FilterOption {
  value: string;
  label: string;
  icon?: string;
}

/**
 * FilterMenuComponent
 * -------------------
 * The "Filter" button from the design, opening a dropdown of options.
 * Two-way binds the selected value: <app-filter-menu [options]="…" [(value)]="status" />
 * The value 'all' means no filter; the button is highlighted when a filter is active.
 */
@Component({
  selector: 'app-filter-menu',
  imports: [IconComponent, TranslatePipe],
  template: `
    <div class="position-relative">
      <button type="button" class="btn-fs" [class.active]="value() !== 'all'" (click)="open.set(!open())" [attr.aria-expanded]="open()" aria-haspopup="listbox">
        <app-icon name="filter" class="filter-icon" />
        {{ 'common.filter' | translate }}
      </button>
      @if (open()) {
        <ul class="dropdown-menu show filter-dropdown" role="listbox">
          @for (opt of options(); track opt.value) {
            <li>
              <button type="button" class="dropdown-item d-flex align-items-center justify-content-between gap-3" role="option"
                      [attr.aria-selected]="value() === opt.value" (click)="select(opt.value)">
                {{ opt.label | translate }}
                @if (value() === opt.value) {
                  <app-icon name="check" class="check" />
                }
              </button>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    .filter-dropdown {
      position: absolute;
      top: calc(100% + 0.375rem);
      inset-inline-end: 0;
      min-width: 11rem;
      font-size: 0.9375rem;
      z-index: 1050;
    }
  `,
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'open.set(false)',
  },
})
export class FilterMenuComponent {
  readonly options = input.required<FilterOption[]>();
  /** Selected value (two-way bindable). */
  readonly value = model('all');

  protected readonly open = signal(false);
  private readonly host = inject(ElementRef<HTMLElement>);

  protected select(value: string): void {
    this.value.set(value);
    this.open.set(false);
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }
}
