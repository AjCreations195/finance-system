import { Component, inject, input } from '@angular/core';
import { LanguageCode, LanguageService } from '../../../core/services/language.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

/**
 * LanguageSwitcherComponent
 * -------------------------
 * Segmented "EN | Ar" toggle from the Figma navbar: both languages are
 * visible and the current one is highlighted, so it's clear what's selected
 * and what a click does. Choosing Arabic switches the layout to RTL
 * (handled by LanguageService).
 *
 * The order is always EN then Ar (dir="ltr" on the group), as in the design,
 * so the control doesn't jump when the page direction flips.
 * Each option says its full language name to screen readers, in that language.
 *
 * `compact` = slightly smaller, for the navbar.
 */
@Component({
  selector: 'app-language-switcher',
  imports: [TranslatePipe],
  template: `
    <div class="lang-toggle" [class.compact]="compact()" role="group" dir="ltr" [attr.aria-label]="'common.language' | translate">
      @for (option of options; track option.code) {
        <button
          type="button"
          class="lang-option"
          [class.active]="language.lang() === option.code"
          [attr.aria-pressed]="language.lang() === option.code"
          [attr.aria-label]="option.name"
          [attr.lang]="option.code"
          (click)="language.setLanguage(option.code)"
        >
          {{ option.short }}
        </button>
      }
    </div>
  `,
  styles: `
    .lang-toggle {
      display: inline-flex;
      align-items: center;
      gap: 0.125rem;
      height: 2.75rem;
      padding: 0.25rem;
      border: 1px solid var(--fs-border);
      border-radius: 0.75rem; /* same as the theme button next to it */
      background: var(--fs-surface-2);

      &.compact {
        height: 2.5rem;
      }
    }

    .lang-option {
      height: 100%;
      min-width: 2.75rem;
      padding: 0 0.875rem;
      border: 0;
      border-radius: 0.5rem; /* outer 12px minus the 4px padding: parallel curves */
      background: transparent;
      color: var(--fs-text-muted);
      font-size: 0.9375rem;
      font-weight: 600;
      line-height: 1;
      transition: background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;

      &:hover:not(.active) {
        color: var(--fs-text);
      }

      &.active {
        background: var(--fs-surface);
        color: var(--fs-text);
        box-shadow: 0 1px 3px rgba(16, 24, 40, 0.1), 0 1px 2px rgba(16, 24, 40, 0.06);
        cursor: default;
      }
    }

    /* Dark theme: the surface color is darker than the track, so lift the
       selected option with a light overlay instead, or it would look sunken. */
    :host-context([data-bs-theme='dark']) .lang-option.active {
      background: rgba(255, 255, 255, 0.14);
      box-shadow: none;
    }

    .compact .lang-option {
      min-width: 2.5rem;
      padding: 0 0.75rem;
      font-size: 0.875rem;
    }

    /* Phones: narrower, so the navbar fits 360px screens */
    @media (max-width: 575.98px) {
      .lang-toggle.compact {
        height: 2.25rem;
      }

      .compact .lang-option {
        min-width: 2rem;
        padding: 0 0.5rem;
      }
    }
  `,
})
export class LanguageSwitcherComponent {
  protected readonly language = inject(LanguageService);

  /** Slightly smaller variant for the navbar. */
  readonly compact = input(false);

  protected readonly options: { code: LanguageCode; short: string; name: string }[] = [
    { code: 'en', short: 'EN', name: 'English' },
    { code: 'ar', short: 'AR', name: 'العربية' },
  ];
}
