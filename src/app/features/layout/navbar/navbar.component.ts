import { Component, inject, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { LanguageService } from '../../../core/services/language.service';
import { ToastService } from '../../../core/services/toast.service';
import { LanguageSwitcherComponent } from '../../../shared/components/language-switcher/language-switcher.component';
import { ThemeToggleComponent } from '../../../shared/components/theme-toggle/theme-toggle.component';
import { LocalizePipe } from '../../../shared/pipes/localize.pipe';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { NotificationsMenuComponent } from '../notifications-menu/notifications-menu.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';

/**
 * NavbarComponent
 * ---------------
 * Top bar from the design, in reading order:
 *   [logo][system name | department] ··· [search] ··· [user ▾] [icons…]
 *
 * Icon group: calendar, messages, language, Dark/Light toggle, notifications.
 * The language button isn't in the Figma but is required by the task.
 * On phones the search and the text parts are hidden, and a hamburger
 * button opens the sidebar.
 */
@Component({
  selector: 'app-navbar',
  imports: [TranslatePipe, LocalizePipe, ThemeToggleComponent, LanguageSwitcherComponent, NotificationsMenuComponent, IconComponent],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'userMenuOpen.set(false)',
  },
})
export class NavbarComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  /** Asks the layout to open the mobile sidebar. */
  readonly menuToggle = output<void>();

  protected readonly userMenuOpen = signal(false);

  protected toggleUserMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.userMenuOpen.update((o) => !o);
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (this.userMenuOpen() && !(event.target as HTMLElement).closest('.user-menu')) {
      this.userMenuOpen.set(false);
    }
  }

  /** Calendar / messages / global search: modules outside this task. */
  protected notAvailable(): void {
    this.toast.show(this.language.translate('login.featureNotAvailable'), 'info');
  }

  protected logout(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
