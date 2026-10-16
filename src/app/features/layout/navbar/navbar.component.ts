import { Component, ElementRef, Injector, afterNextRender, computed, inject, output, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { LanguageService } from '../../../core/services/language.service';
import { ThemeService } from '../../../core/services/theme.service';
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
 * Icon group: messages, language, Dark/Light toggle, notifications.
 * The language button isn't in the Figma but is required by the task.
 * The search box shows only on xl+ (below that it crowds the bar).
 * Below lg (phones, tablets) the system name is hidden too, and a hamburger
 * button opens the sidebar. On phones the language and theme controls move
 * into the user menu, leaving [☰][logo] ··· [avatar][bell].
 */
@Component({
  selector: 'app-navbar',
  imports: [TranslatePipe, LocalizePipe, ThemeToggleComponent, LanguageSwitcherComponent, NotificationsMenuComponent, IconComponent],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'closeUserMenu(true)',
  },
})
export class NavbarComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);
  private readonly injector = inject(Injector);
  private readonly theme = inject(ThemeService);

  /** The logo's text is black; the dark theme uses a copy with light text. */
  protected readonly logoSrc = computed(() => (this.theme.isDark() ? 'images/moi-logo-dark.svg' : 'images/moi-logo.svg'));

  /** Asks the layout to open the mobile sidebar. */
  readonly menuToggle = output<void>();

  protected readonly userMenuOpen = signal(false);
  private readonly userBtn = viewChild<ElementRef<HTMLButtonElement>>('userBtn');
  private readonly userDropdown = viewChild<ElementRef<HTMLElement>>('userDropdown');

  protected toggleUserMenu(event: MouseEvent): void {
    event.stopPropagation();
    if (this.userMenuOpen()) {
      this.closeUserMenu();
      return;
    }
    this.userMenuOpen.set(true);
    // Focus moves to the panel itself, not to Logout, so a stray Enter can't sign out.
    afterNextRender(() => this.userDropdown()?.nativeElement.focus(), { injector: this.injector });
  }

  /** Closes the menu; with `restoreFocus` (Esc) focus goes back to the avatar button. */
  protected closeUserMenu(restoreFocus = false): void {
    if (!this.userMenuOpen()) return;
    this.userMenuOpen.set(false);
    if (restoreFocus) this.userBtn()?.nativeElement.focus();
  }

  /** Tabbing out of the menu closes it (moving between its own controls doesn't). */
  protected onMenuFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as HTMLElement | null;
    if (next && !next.closest('.user-menu')) this.closeUserMenu();
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (this.userMenuOpen() && !(event.target as HTMLElement).closest('.user-menu')) {
      this.userMenuOpen.set(false);
    }
  }

  /** Messages / global search: modules outside this task. */
  protected notAvailable(): void {
    this.toast.show(this.language.translate('login.featureNotAvailable'), 'info');
  }

  protected logout(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
