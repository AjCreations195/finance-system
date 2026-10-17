import { Component, inject, input } from '@angular/core';
import { ThemeService } from '../../../core/services/theme.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { IconComponent } from '../icon/icon.component';

/**
 * ThemeToggleComponent
 * --------------------
 * Button that switches between Light and Dark mode. It shows the mode
 * you'll switch TO: the moon while light, the sun while dark.
 * - Login (Figma): white rounded square with the filled navy moon.
 * - Navbar (`compact`): the shared .nav-btn, like the other navbar
 *   buttons.
 */
@Component({
  selector: 'app-theme-toggle',
  imports: [TranslatePipe, IconComponent],
  template: `
    <button
      type="button"
      [class]="compact() ? 'nav-btn' : 'theme-btn'"
      (click)="theme.toggle()"
      [attr.aria-label]="'common.toggleTheme' | translate"
      [title]="(theme.isDark() ? 'common.lightMode' : 'common.darkMode') | translate"
    >
      <app-icon [name]="theme.isDark() ? 'sun' : 'moon'" [class.sun]="theme.isDark()" />
    </button>
  `,
  styles: `
    .theme-btn {
      display: inline-grid;
      place-items: center;
      width: 2.75rem;
      height: 2.75rem;
      padding: 0;
      border: 1px solid var(--fs-border);
      border-radius: 0.75rem;
      background: var(--fs-surface);
      color: #0e253c; /* the moon's color in Figma */
      font-size: 1.125rem; /* 18px moon, as exported */
      box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05);
      transition: background-color 0.15s ease;

      &:hover {
        background: var(--fs-surface-2);
      }
    }

    /* The sun is a Material icon with built-in padding: a bit larger to match the moon */
    .sun {
      font-size: 1.375rem;
    }

    :host-context([data-bs-theme='dark']) .theme-btn {
      color: var(--fs-text);
    }
  `,
})
export class ThemeToggleComponent {
  /** Shared theme state; the button calls toggle() on it. */
  protected readonly theme = inject(ThemeService);

  /** Navbar look: the shared 40px .nav-btn instead of the larger login square. */
  readonly compact = input(false);
}
