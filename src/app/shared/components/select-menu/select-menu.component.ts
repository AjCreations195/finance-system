import { Component, ElementRef, Injector, afterNextRender, computed, inject, input, model, signal } from '@angular/core';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { FilterOption } from '../filter-menu/filter-menu.component';
import { IconComponent } from '../icon/icon.component';

/**
 * SelectMenuComponent
 * -------------------
 * A styled single-select dropdown that shows the chosen option on its
 * button (icon + label), replacing the browser's native <select> so it
 * matches the other toolbar controls in both themes and directions.
 *
 * Keyboard: ↑/↓/Home/End move between options, Enter/Space select,
 * Esc or Tab closes; focus returns to the button after a choice.
 *
 * @example <app-select-menu [options]="categoryOptions" [(value)]="category" ariaLabel="procurement.category" />
 * @example <app-select-menu [options]="filters" [(value)]="filter" appearance="text" align="start" />
 *   appearance="text": borderless "Label ⌄" trigger (e.g. inside a panel header)
 *   align="start": the list opens under the trigger toward the inline end
 */
@Component({
  selector: 'app-select-menu',
  imports: [IconComponent, TranslatePipe],
  template: `
    <div class="position-relative">
      <button #trigger type="button" class="trigger" [class.btn-fs]="appearance() === 'button'" [class.text-trigger]="appearance() === 'text'" (click)="toggle()" (keydown.arrowDown)="openAndFocus($event)" (keydown.arrowUp)="openAndFocus($event)"
              [attr.aria-expanded]="open()" aria-haspopup="listbox" [attr.aria-label]="ariaLabel() ? (ariaLabel() | translate) + ': ' + (selected().label | translate) : null">
        @if (selected().icon) {
          <app-icon [name]="selected().icon!" />
        }
        <span class="trigger-label">{{ selected().label | translate }}</span>
        <app-icon name="chevron-down" class="chevron" [class.flipped]="open()" />
      </button>

      @if (open()) {
        <ul #list class="dropdown-menu show menu" [class.align-start]="align() === 'start'" role="listbox" [attr.aria-label]="ariaLabel() | translate" (keydown)="onListKeydown($event, trigger)">
          @for (opt of options(); track opt.value) {
            <li>
              <button type="button" class="dropdown-item option" role="option" [class.selected]="opt.value === value()" [attr.aria-selected]="opt.value === value()"
                      (click)="select(opt.value, trigger)">
                @if (opt.icon) {
                  <app-icon [name]="opt.icon" class="option-icon" />
                }
                <span class="flex-grow-1">{{ opt.label | translate }}</span>
                @if (opt.value === value()) {
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
    .trigger {
      max-width: 14rem;
      font-size: 0.875rem;
      white-space: nowrap;
    }
    .trigger-label {
      overflow: hidden;
      text-overflow: ellipsis;
    }
    /* Borderless "Label ⌄" trigger */
    .text-trigger {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.125rem 0;
      border: 0;
      background: none;
      color: var(--fs-text-muted);
      font-size: 0.9375rem;

      &:hover,
      &[aria-expanded='true'] {
        color: var(--fs-text);
      }
    }
    .chevron {
      margin-inline-start: 0.125rem;
      font-size: 0.875rem;
      color: var(--fs-text-muted);
      transition: transform 0.2s ease;

      &.flipped {
        transform: rotate(180deg);
      }
    }
    .menu {
      position: absolute;
      top: calc(100% + 0.375rem);
      inset-inline-end: 0;
      min-width: 100%;
      width: max-content;
      max-height: 18rem;
      overflow-y: auto;
      padding: 0.375rem;
      z-index: 1050;

      &.align-start {
        inset-inline-end: auto;
        inset-inline-start: 0;
      }
    }
    .option {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.45rem 0.625rem;
      border-radius: 0.375rem;
      font-size: 0.9375rem;

      &.selected {
        background: var(--fs-primary-soft);
        color: var(--fs-primary-text);
        font-weight: 600;
      }
    }
    .option-icon {
      color: var(--fs-text-muted);
    }
    .option.selected .option-icon,
    .check {
      color: var(--fs-primary-text);
    }
  `,
  host: {
    '(document:click)': 'onDocumentClick($event)',
  },
})
export class SelectMenuComponent {
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly injector = inject(Injector);

  readonly options = input.required<FilterOption[]>();
  /** Selected value (two-way bindable). */
  readonly value = model.required<string>();
  /** Translation key naming the control, for screen readers. */
  readonly ariaLabel = input('');
  /** 'button' = bordered toolbar button; 'text' = borderless "Label ⌄". */
  readonly appearance = input<'button' | 'text'>('button');
  /** Which edge of the trigger the list lines up with. */
  readonly align = input<'start' | 'end'>('end');

  protected readonly open = signal(false);
  protected readonly selected = computed(() => this.options().find((o) => o.value === this.value()) ?? this.options()[0]);

  protected toggle(): void {
    this.open.set(!this.open());
    if (this.open()) this.focusSelectedAfterRender();
  }

  /** ↑/↓ on the closed button opens the list on the selected option. */
  protected openAndFocus(event: Event): void {
    event.preventDefault();
    this.open.set(true);
    this.focusSelectedAfterRender();
  }

  protected select(value: string, trigger: HTMLButtonElement): void {
    this.value.set(value);
    this.close(trigger);
  }

  protected onListKeydown(event: KeyboardEvent, trigger: HTMLButtonElement): void {
    const moves: Record<string, 'next' | 'prev' | 'first' | 'last'> = { ArrowDown: 'next', ArrowUp: 'prev', Home: 'first', End: 'last' };
    if (moves[event.key]) {
      event.preventDefault();
      this.focusOption(moves[event.key]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation(); // close only this list, not a panel around it
      this.close(trigger);
    } else if (event.key === 'Tab') {
      this.open.set(false);
    }
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }

  private close(trigger: HTMLButtonElement): void {
    this.open.set(false);
    trigger.focus();
  }

  private focusSelectedAfterRender(): void {
    afterNextRender(() => this.focusOption('selected'), { injector: this.injector });
  }

  /** Moves focus inside the open list. */
  private focusOption(target: 'selected' | 'next' | 'prev' | 'first' | 'last'): void {
    const items = Array.from(this.host.nativeElement.querySelectorAll<HTMLButtonElement>('[role="option"]'));
    if (!items.length) return;
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const selectedIndex = Math.max(0, items.findIndex((i) => i.getAttribute('aria-selected') === 'true'));
    const index = {
      selected: selectedIndex,
      next: Math.min(items.length - 1, current + 1),
      prev: Math.max(0, current - 1),
      first: 0,
      last: items.length - 1,
    }[target];
    items[index].focus();
  }
}
