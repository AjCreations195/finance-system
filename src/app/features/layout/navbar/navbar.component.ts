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
import { PurchaseRequest, STATUS_BADGE } from '../../../core/models/purchase-request.model';
import { PurchaseRequestService } from '../../../core/services/purchase-request.service';
import { WorkspaceTabsService } from '../../../core/services/workspace-tabs.service';
import { NAV_FOOTER, NAV_TREE, NAV_TREE_SECONDARY, NavNode } from '../sidebar/nav-items';
import { ChatService } from '../../../core/services/chat.service';
import { CHAT_TOGGLE_ID } from '../chat-panel/chat-panel.component';

/** Most results per group in the search dropdown. */
const MAX_PAGES = 4;
const MAX_REQUESTS = 5;

/** "View all" opens the purchase requests list filtered by the search term (?q=). */
const REQUESTS_PAGE = '/procurement/purchase-requests';

/** One row of the search dropdown. */
type SearchOption =
  | { kind: 'page'; node: NavNode }
  | { kind: 'request'; request: PurchaseRequest }
  | { kind: 'all' };

/** Every page in the sidebar menu (its leaves), minus the greyed-out ones. */
const SEARCHABLE_PAGES: NavNode[] = (function leaves(nodes: NavNode[]): NavNode[] {
  return nodes.flatMap((n) => (n.children ? leaves(n.children) : n.disabled ? [] : [n]));
})([...NAV_TREE, ...NAV_TREE_SECONDARY, ...NAV_FOOTER]);

/**
 * NavbarComponent
 * ---------------
 * Top bar from the design, in reading order:
 *   [logo][system name | department] ··· [search] ··· [user ▾] [icons…]
 *
 * Icon group: AI assistant (chat), language, Dark/Light toggle, notifications.
 * The language button isn't in the Figma but is required by the task.
 * The search box shows only on xl+ (below that it crowds the bar). It finds
 * sidebar pages and purchase requests as you type ("/" focuses it).
 * Below lg (phones, tablets) the system name is hidden too, and a hamburger
 * button opens the sidebar. On phones the language and theme controls move
 * into the user menu, leaving [☰][logo] ··· [avatar][chat][bell].
 */
@Component({
  selector: 'app-navbar',
  imports: [TranslatePipe, LocalizePipe, ThemeToggleComponent, LanguageSwitcherComponent, NotificationsMenuComponent, IconComponent],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'closeUserMenu(true)',
    '(document:keydown)': 'onDocumentKeydown($event)',
  },
})
export class NavbarComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);
  private readonly injector = inject(Injector);
  private readonly theme = inject(ThemeService);
  private readonly requests = inject(PurchaseRequestService);
  private readonly workspace = inject(WorkspaceTabsService);

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

  // ------------------------------------------------------------------
  // Global search: menu pages + purchase requests, as an ARIA combobox
  // ------------------------------------------------------------------
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  protected readonly query = signal('');
  private readonly searchFocused = signal(false);
  /** Highlighted option (index into `options`), moved with ↑ / ↓. */
  protected readonly active = signal(0);

  private readonly term = computed(() => this.query().trim().toLowerCase());

  /** Sidebar leaves whose label matches (disabled items can't be opened, so they're left out). */
  protected readonly pageResults = computed<NavNode[]>(() => {
    const q = this.term();
    if (!q) return [];
    this.language.lang(); // re-run when the language (and so the labels) change
    return SEARCHABLE_PAGES.filter((n) => this.language.translate(n.label).toLowerCase().includes(q)).slice(0, MAX_PAGES);
  });

  /** Every matching request (the count feeds "View all"); the dropdown shows the first few. */
  private readonly requestMatches = computed<PurchaseRequest[]>(() => {
    const q = this.term();
    if (!q) return [];
    const lang = this.language.lang();
    return this.requests
      .requests()
      .filter(
        (r) =>
          r.number.toLowerCase().includes(q) ||
          r.description[lang].toLowerCase().includes(q) ||
          r.budgetItem.name[lang].toLowerCase().includes(q) ||
          r.budgetItem.code.includes(q) ||
          r.creator.name[lang].toLowerCase().includes(q),
      );
  });
  protected readonly requestResults = computed(() => this.requestMatches().slice(0, MAX_REQUESTS));
  protected readonly requestCount = computed(() => this.requestMatches().length);

  /** Flat option list in display order: pages, requests, then "View all". */
  protected readonly options = computed<SearchOption[]>(() => [
    ...this.pageResults().map((node) => ({ kind: 'page' as const, node })),
    ...this.requestResults().map((request) => ({ kind: 'request' as const, request })),
    ...(this.requestCount() ? [{ kind: 'all' as const }] : []),
  ]);

  protected readonly searchOpen = computed(() => this.searchFocused() && !!this.term());
  protected readonly activeId = computed(() => (this.searchOpen() && this.options().length ? `gs-opt-${this.active()}` : null));
  protected readonly statusBadge = STATUS_BADGE;

  protected onQuery(value: string): void {
    this.query.set(value);
    this.active.set(0);
  }

  protected onSearchFocus(focused: boolean): void {
    this.searchFocused.set(focused);
  }

  /** ↑ / ↓ move the highlight, Enter opens it, Esc clears the box. */
  protected onSearchKey(event: KeyboardEvent): void {
    const count = this.options().length;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        if (!count) return;
        event.preventDefault();
        this.active.update((i) => (i + (event.key === 'ArrowDown' ? 1 : count - 1)) % count);
        this.scrollActiveIntoView();
        break;
      case 'Enter':
        event.preventDefault();
        if (this.searchOpen() && count) this.choose(this.active());
        break;
      case 'Escape':
        // Handled here so it doesn't also close panels on the page behind.
        event.stopPropagation();
        if (this.query()) this.onQuery('');
        else this.searchInput()?.nativeElement.blur();
        break;
    }
  }

  protected choose(index: number): void {
    const option = this.options()[index];
    if (!option) return;
    const term = this.query().trim();
    this.onQuery('');
    this.searchInput()?.nativeElement.blur();

    if (option.kind === 'request') {
      this.workspace.openRequest(option.request.id);
    } else if (option.kind === 'all') {
      void this.router.navigate([REQUESTS_PAGE], { queryParams: { q: term } });
    } else if (option.node.route) {
      void this.router.navigateByUrl(option.node.route);
    } else {
      this.notAvailable();
    }
  }

  /** "/" focuses the search from anywhere, unless the user is typing in a field. */
  protected onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as HTMLElement;
    if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
    const input = this.searchInput()?.nativeElement;
    if (!input || !input.offsetParent) return; // hidden below xl
    event.preventDefault();
    input.focus();
  }

  private scrollActiveIntoView(): void {
    afterNextRender(() => document.getElementById(`gs-opt-${this.active()}`)?.scrollIntoView({ block: 'nearest' }), {
      injector: this.injector,
    });
  }

  protected readonly chat = inject(ChatService);
  protected readonly chatToggleId = CHAT_TOGGLE_ID;

  protected toggleChat(event: MouseEvent): void {
    event.stopPropagation();
    this.chat.toggle();
  }

  /** Sidebar pages without a route: a module outside this task. */
  protected notAvailable(): void {
    this.toast.show(this.language.translate('login.featureNotAvailable'), 'info');
  }

  protected logout(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
