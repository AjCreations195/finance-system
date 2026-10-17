import { Component, DestroyRef, ElementRef, inject, input, model, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
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
      <button type="button" class="btn-fs" [class.active]="value() !== 'all'" (click)="toggle($event)" [attr.aria-expanded]="open()" aria-haspopup="listbox">
        <app-icon name="filter" class="filter-icon" />
        {{ 'common.filter' | translate }}
      </button>
      @if (open()) {
        <ul class="dropdown-menu show filter-dropdown" role="listbox" [style.top.px]="pos().top" [style.left.px]="pos().left" [style.max-height.px]="pos().maxHeight">
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
    /* Fixed, not absolute: dashboard cards clip overflow, which cut the menu off
       on narrow screens. Position is set from the button in toggle(). */
    .filter-dropdown {
      position: fixed;
      min-width: 11rem;
      overflow-y: auto;
      font-size: 0.9375rem;
      z-index: 1050;
    }
  `,
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'open.set(false)',
    '(window:resize)': 'open.set(false)',
  },
})
export class FilterMenuComponent {
  readonly options = input.required<FilterOption[]>();
  /** Selected value (two-way bindable). */
  readonly value = model('all');

  /** Whether the dropdown is visible. */
  protected readonly open = signal(false);
  /** Where the dropdown is drawn (viewport coordinates, see place()). */
  protected readonly pos = signal({ top: 0, left: 0, maxHeight: 0 });
  private readonly host = inject(ElementRef<HTMLElement>);
  /** The button that opened the menu; the menu follows it when the page scrolls. */
  private anchor: HTMLElement | null = null;

  /** Menu width used to keep it inside the screen (matches min-width: 11rem). */
  private static readonly MENU_WIDTH = 176;
  private static readonly GUTTER = 8;
  /** Tallest the menu gets before it scrolls (18rem). */
  private static readonly MAX_HEIGHT = 288;

  constructor() {
    // Scrolls inside the page don't bubble, so listen in the capture phase.
    // Keeps the open menu attached to its button while the page scrolls.
    const onScroll = () => {
      if (this.open()) this.place();
    };
    const doc = inject(DOCUMENT);
    doc.addEventListener('scroll', onScroll, { capture: true, passive: true });
    inject(DestroyRef).onDestroy(() => doc.removeEventListener('scroll', onScroll, { capture: true }));
  }

  /** Opens the menu under the clicked button, or closes it if it is already open. */
  protected toggle(event: MouseEvent): void {
    if (this.open()) {
      this.open.set(false);
      return;
    }
    this.anchor = event.currentTarget as HTMLElement;
    this.place();
    this.open.set(true);
  }

  /** Puts the menu under the button, end-aligned and kept on screen. Closes it if the button scrolls out of view. */
  private place(): void {
    if (!this.anchor) return;
    const rect = this.anchor.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      this.open.set(false);
      return;
    }
    const { MENU_WIDTH, GUTTER, MAX_HEIGHT } = FilterMenuComponent;
    const left = Math.min(Math.max(rect.right - MENU_WIDTH, GUTTER), window.innerWidth - MENU_WIDTH - GUTTER);
    const top = rect.bottom + 6;
    // Long lists scroll inside the menu: capped at 18rem, and never taller than the space left on screen
    const maxHeight = Math.max(Math.min(MAX_HEIGHT, window.innerHeight - top - GUTTER), 120);
    this.pos.set({ top, left, maxHeight });
  }

  /** Picks an option and closes the menu. */
  protected select(value: string): void {
    this.value.set(value);
    this.open.set(false);
  }

  /** Closes the menu when a click lands outside this component. */
  protected onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }
}
