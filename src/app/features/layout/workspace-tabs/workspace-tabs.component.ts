import { Component, DestroyRef, ElementRef, Injector, afterNextRender, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, NavigationStart, Router, RouterLink } from '@angular/router';
import { filter, fromEvent, map } from 'rxjs';
import { PurchaseRequest, STATUS_BADGE, TAB_STATUSES } from '../../../core/models/purchase-request.model';
import { LanguageService } from '../../../core/services/language.service';
import { PageStateService } from '../../../core/services/page-state.service';
import { PurchaseRequestService } from '../../../core/services/purchase-request.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  MODULES,
  WorkspaceTab,
  WorkspaceTabsService,
  moduleDef,
  pageOf,
  scrollKey,
} from '../../../core/services/workspace-tabs.service';
import { LocalizePipe } from '../../../shared/pipes/localize.pipe';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { IconComponent } from '../../../shared/components/icon/icon.component';

/** Everything the template needs to draw one tab. */
interface TabView {
  tab: WorkspaceTab;
  label: string;
  /** Hover / focus card with the full details. */
  tip: TabTip;
  icon: string | null;
  /** Status color of a record tab. */
  dot: string | null;
  /** Requests waiting for action (Purchase request tab). */
  badge: number;
  routable: boolean;
  pinned: boolean;
  active: boolean;
}

/** Tooltip content: request tabs show number, status and description; Purchase request explains its count. */
interface TabTip {
  heading: string;
  /** Request numbers ("BDRS/2016/019/0008") read left to right in Arabic too. */
  ltr: boolean;
  status?: { label: string; family: string };
  detail?: string;
  count?: string;
}

/** One breadcrumb item. `link` is set on items that go back to a page. */
interface Crumb {
  label: string;
  link?: string;
}

/** Open context menu / "+" menu, positioned with `position: fixed` (the strip scrolls and would clip it). */
interface MenuPosition {
  top: number;
  left: number;
}

const ADD_MENU_WIDTH = 320;
const TAB_MENU_WIDTH = 232;
const SEARCH_RESULTS = 6;
/** Tooltip: hover delay, grace period to move onto it, half its max width (for viewport clamping). */
const TIP_DELAY = 450;
const TIP_GRACE = 120;
const TIP_HALF_WIDTH = 144;
/** Tooltip id of the "+" button (tab ids are "dashboard", "request-8"…, so no clash). */
const ADD_TIP = '+';

/**
 * WorkspaceTabsComponent
 * ----------------------
 * The breadcrumb + browser-style tab strip above the page content.
 * The tabs model lives in WorkspaceTabsService; this component draws it
 * and handles the interaction:
 *
 *  - Tabs: pages (Dashboard is pinned) and open purchase requests, each
 *    with its status color. Switching tabs restores the page's scroll.
 *  - Close: ×, middle-click, Delete, Alt+W; right-click (or Shift+F10)
 *    for Close others / to the right / all and Reopen closed tab.
 *  - "+": quick-open menu to find a request, open a page, or bring back
 *    a recently closed tab.
 *  - Keyboard: arrow keys move between tabs (one tab stop), Alt+1…9 jump.
 *  - Breadcrumb: from the active route's `breadcrumb` data (app.routes.ts),
 *    plus the request number when a request is open.
 */
@Component({
  selector: 'app-workspace-tabs',
  imports: [IconComponent, RouterLink, TranslatePipe, LocalizePipe],
  templateUrl: './workspace-tabs.component.html',
  styleUrl: './workspace-tabs.component.scss',
  host: {
    '(document:click)': 'closeMenus()',
    '(document:keydown)': 'onShortcut($event)',
    '(document:keydown.escape)': 'hideTip(0)',
    '(window:resize)': 'closeMenus(); hideTip(0)',
  },
})
export class WorkspaceTabsComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);
  private readonly requests = inject(PurchaseRequestService);
  private readonly pageState = inject(PageStateService);
  private readonly injector = inject(Injector);
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  protected readonly workspace = inject(WorkspaceTabsService);

  protected readonly modules = MODULES;

  /** Current URL as a signal. */
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  // ------------------------------------------------------------------
  // Tabs
  // ------------------------------------------------------------------

  /** Requests under procedure, shown as a count on the Purchase request tab. */
  private readonly underProcedure = computed(
    () => this.requests.requests().filter((r) => TAB_STATUSES.inProgress.includes(r.status)).length,
  );

  /** Everything the template draws for each open tab, built from the tabs model and the request data. */
  protected readonly views = computed<TabView[]>(() => {
    const activeId = this.workspace.activeId();
    return this.workspace.tabs().map((tab) => {
      const base = { tab, active: tab.id === activeId, pinned: this.workspace.isPinned(tab) };
      if (tab.kind === 'record') {
        const request = this.requests.getById(tab.requestId);
        const label = request?.number ?? `#${tab.requestId}`;
        return {
          ...base,
          label,
          tip: {
            heading: label,
            ltr: true,
            status: request && {
              label: this.language.translate(`requests.status.${request.status}`),
              family: STATUS_BADGE[request.status],
            },
            detail: request?.description[this.language.lang()],
          },
          icon: null,
          dot: request ? `var(--fs-badge-${STATUS_BADGE[request.status]})` : null,
          badge: 0,
          routable: true,
        };
      }
      const def = moduleDef(tab.id)!;
      const label = this.language.translate(def.label);
      const badge = tab.id === 'procurement' ? this.underProcedure() : 0;
      return {
        ...base,
        label,
        // The count alone is unclear, so the tooltip spells it out ("42 under procedure").
        tip: {
          heading: label,
          ltr: false,
          count: badge ? this.language.translate('layout.tabs.underProcedure', { count: badge }) : undefined,
        },
        icon: def.icon,
        dot: null,
        badge,
        routable: !!def.route,
      };
    });
  });

  /** Tab that takes the keyboard focus stop (the active one, else the first). */
  protected readonly focusId = computed(() => {
    const views = this.views();
    return (views.find((v) => v.active) ?? views[0])?.tab.id;
  });

  protected readonly openIds = computed(() => new Set(this.workspace.tabs().map((t) => t.id)));

  /** Recently closed tabs for the "+" menu, labelled. */
  protected readonly recentlyClosed = computed(() =>
    this.workspace
      .closed()
      .slice(0, 5)
      .map((tab) => {
        if (tab.kind === 'module') return { tab, label: this.language.translate(moduleDef(tab.id)!.label), icon: moduleDef(tab.id)!.icon };
        return { tab, label: this.requests.getById(tab.requestId)?.number ?? `#${tab.requestId}`, icon: 'receipt' };
      }),
  );

  // ------------------------------------------------------------------
  // Breadcrumb
  // ------------------------------------------------------------------

  protected readonly breadcrumb = computed<Crumb[]>(() => {
    this.url(); // re-evaluate on navigation
    let r = this.route.snapshot;
    while (r.firstChild) r = r.firstChild;
    const crumbs: Crumb[] = ((r.data['breadcrumb'] as string[] | undefined) ?? []).map((key) => ({
      label: this.language.translate(key),
    }));

    // A request is open: "… › Purchase request › PR-0008", with a link back to the list.
    const active = this.workspace.tabFor(this.url());
    const request = active?.kind === 'record' ? this.requests.getById(active.requestId) : undefined;
    if (request && crumbs.length) {
      crumbs[crumbs.length - 1].link = this.url().split('?')[0];
      crumbs.push({ label: request.number });
    }
    return crumbs;
  });

  // ------------------------------------------------------------------
  // Menus
  // ------------------------------------------------------------------

  /** Right-click menu: which tab it's for, and where. */
  protected readonly tabMenu = signal<(MenuPosition & { id: string }) | null>(null);
  protected readonly addMenu = signal<MenuPosition | null>(null);
  protected readonly query = signal('');

  /** Quick-open search over purchase requests (number, description, budget code). */
  protected readonly results = computed<PurchaseRequest[]>(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return [];
    const lang = this.language.lang();
    return this.requests
      .requests()
      .filter((r) => r.number.toLowerCase().includes(q) || r.description[lang].toLowerCase().includes(q) || r.budgetItem.code.includes(q))
      .slice(0, SEARCH_RESULTS);
  });

  /** CSS colour of a request's status badge (for the quick-open results). */
  protected readonly badgeOf = (r: PurchaseRequest) => `var(--fs-badge-${STATUS_BADGE[r.status]})`;

  /** Element to focus again when a menu closes. */
  private menuReturnFocus: HTMLElement | null = null;

  constructor() {
    this.restoreScrollOnTabSwitch();

    // Keep the active tab visible when the strip overflows.
    effect(() => {
      const id = this.workspace.activeId();
      afterNextRender(() => this.tabButton(id)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }), {
        injector: this.injector,
      });
    });

    // Fixed-position menus would drift away from their tab when the page scrolls.
    fromEvent(this.host.ownerDocument, 'scroll', { capture: true })
      .pipe(takeUntilDestroyed())
      .subscribe((e) => {
        this.hideTip(0);
        if (!(e.target instanceof Node) || !this.host.contains(e.target)) this.closeMenus();
      });

    inject(DestroyRef).onDestroy(() => clearTimeout(this.tipTimer));
  }

  // ------------------------------------------------------------------
  // Tab actions
  // ------------------------------------------------------------------

  /** Switches to a tab; tabs without a page yet show the "not available" notice. */
  protected select(view: TabView): void {
    this.hideTip(0);
    if (!this.workspace.activate(view.tab)) this.toast.unavailable();
  }

  /** Closes a tab (not the pinned Dashboard). If focus was in the strip, it moves to the neighbouring tab. */
  protected close(view: TabView, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (view.pinned) return;
    this.hideTip(0);
    const index = this.views().findIndex((v) => v.tab.id === view.tab.id);
    const hadFocus = this.host.contains(this.host.ownerDocument.activeElement);
    this.workspace.close(view.tab.id);
    // Keep the keyboard focus in the strip, on the neighbouring tab.
    if (hadFocus) this.focusTabAt(Math.min(index, this.views().length - 1));
  }

  /** Middle-click closes, as in browsers. */
  protected onAuxClick(view: TabView, event: MouseEvent): void {
    if (event.button === 1) this.close(view, event);
  }

  /** Arrow keys move along the strip (mirrored in Arabic), Home/End jump, Delete closes. */
  protected onTabKey(view: TabView, index: number, event: KeyboardEvent): void {
    const count = this.views().length;
    const forward = this.language.isRtl() ? 'ArrowLeft' : 'ArrowRight';
    const back = this.language.isRtl() ? 'ArrowRight' : 'ArrowLeft';
    const target =
      event.key === forward ? (index + 1) % count
      : event.key === back ? (index - 1 + count) % count
      : event.key === 'Home' ? 0
      : event.key === 'End' ? count - 1
      : null;
    if (target !== null) {
      event.preventDefault();
      this.focusTabAt(target);
    } else if (event.key === 'Delete') {
      event.preventDefault();
      this.close(view);
    }
  }


  // ------------------------------------------------------------------
  // Context menu (right-click, Shift+F10, ContextMenu key)
  // ------------------------------------------------------------------

  /** Opens the tab's context menu at the pointer, or under the tab when opened from the keyboard. */
  protected openTabMenu(view: TabView, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.hideTip(0);
    this.addMenu.set(null);
    const label = this.tabButton(view.tab.id);
    this.menuReturnFocus = label;
    // Keyboard-opened menus have no pointer position: open under the tab.
    const rect = label?.getBoundingClientRect();
    const fromKeyboard = !event.clientX && !event.clientY && rect;
    const x = fromKeyboard ? (this.language.isRtl() ? rect.right - TAB_MENU_WIDTH : rect.left) : event.clientX;
    const y = fromKeyboard ? rect.bottom + 4 : event.clientY;
    this.tabMenu.set({ id: view.tab.id, ...this.fit(x, y, TAB_MENU_WIDTH) });
    this.focusFirstItem('.tab-menu');
  }

  /** The tab the context menu is for. */
  protected readonly menuTab = computed(() => this.views().find((v) => v.tab.id === this.tabMenu()?.id) ?? null);

  /** Whether any non-pinned tab sits to the right of the menu's tab (enables "Close tabs to the right"). */
  protected readonly canCloseAfter = computed(() => {
    const id = this.tabMenu()?.id;
    const views = this.views();
    const index = views.findIndex((v) => v.tab.id === id);
    return views.slice(index + 1).some((v) => !v.pinned);
  });

  /** Whether any other non-pinned tab is open (enables "Close other tabs"). */
  protected readonly canCloseOthers = computed(() => this.views().some((v) => !v.pinned && v.tab.id !== this.tabMenu()?.id));

  /** Runs one item of the context menu, then closes the menu and returns focus to the strip. */
  protected menuAction(action: 'close' | 'others' | 'after' | 'all' | 'reopen'): void {
    const view = this.menuTab();
    this.closeMenus(false);
    if (action === 'reopen') return this.workspace.reopen();
    if (!view) return;
    if (action === 'close') this.close(view);
    if (action === 'others') this.workspace.closeOthers(view.tab.id);
    if (action === 'after') this.workspace.closeAfter(view.tab.id);
    if (action === 'all') this.workspace.closeAll();
    this.focusTab(this.focusId());
  }

  // ------------------------------------------------------------------
  // "+" quick-open menu
  // ------------------------------------------------------------------

  /** Opens or closes the "+" menu below its button, and focuses its search box when opened. */
  protected toggleAddMenu(event: MouseEvent): void {
    event.stopPropagation();
    if (this.addMenu()) return this.closeMenus();
    this.hideTip(0);
    this.tabMenu.set(null);
    const button = event.currentTarget as HTMLElement;
    this.menuReturnFocus = button;
    const rect = button.getBoundingClientRect();
    const x = this.language.isRtl() ? rect.right - ADD_MENU_WIDTH : rect.left;
    this.query.set('');
    this.addMenu.set(this.fit(x, rect.bottom + 6, ADD_MENU_WIDTH));
    afterNextRender(() => this.host.querySelector<HTMLInputElement>('.add-menu input')?.focus(), { injector: this.injector });
  }

  /** Opens a request in its own tab, closing the menu first. */
  protected openRequest(request: PurchaseRequest): void {
    this.closeMenus(false);
    this.workspace.openRequest(request.id);
  }

  /** Enter in the search box opens the first match. */
  protected openFirstResult(): void {
    const first = this.results()[0];
    if (first) this.openRequest(first);
  }

  /** Adds a module's tab from the "+" menu, or shows the "not available" notice if the page isn't built. */
  protected openModule(id: string): void {
    this.closeMenus(false);
    if (!this.workspace.openModule(id)) this.toast.unavailable();
  }

  /** Reopens one recently closed tab from the "+" menu. */
  protected reopen(tab: WorkspaceTab): void {
    this.closeMenus(false);
    this.workspace.reopen(tab.id);
  }

  // ------------------------------------------------------------------
  // Shared menu behaviour
  // ------------------------------------------------------------------

  /** Close both menus; `restoreFocus` sends focus back to what opened them (keyboard close). */
  closeMenus(restoreFocus = false): void {
    if (!this.tabMenu() && !this.addMenu()) return;
    this.tabMenu.set(null);
    this.addMenu.set(null);
    if (restoreFocus) this.menuReturnFocus?.focus();
    this.menuReturnFocus = null;
  }

  /** ↑/↓ move through the menu items (and the search box), Esc closes. */
  protected onMenuKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      this.closeMenus(true);
      return;
    }
    if (event.key === 'Tab') {
      this.closeMenus(true);
      event.preventDefault();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const menu = event.currentTarget as HTMLElement;
    const items = [...menu.querySelectorAll<HTMLElement>('input, [role="menuitem"]:not(:disabled)')];
    const index = items.indexOf(this.host.ownerDocument.activeElement as HTMLElement);
    const step = event.key === 'ArrowDown' ? 1 : -1;
    items[(index + step + items.length) % items.length]?.focus();
  }

  // ------------------------------------------------------------------
  // Tooltip (hover after a short delay, or keyboard focus). WCAG 1.4.13:
  // the pointer can move onto it, Esc dismisses it, it stays until left.
  // ------------------------------------------------------------------

  /** Which tooltip is open: a tab id, or ADD_TIP for the "+" button. */
  protected readonly tip = signal<{ id: string; top: number; left: number; caret: number } | null>(null);
  protected readonly tipContent = computed<TabTip | null>(() => {
    const id = this.tip()?.id;
    if (id === ADD_TIP) return { heading: this.language.translate('layout.tabs.add'), ltr: false };
    return this.views().find((v) => v.tab.id === id)?.tip ?? null;
  });
  /** Tooltip id used for the "+" button. */
  protected readonly addTip = ADD_TIP;
  /** Pending hover timer (see showTip / hideTip). */
  private tipTimer: ReturnType<typeof setTimeout> | undefined;

  /** Hover: wait a moment (no flicker when sweeping across the strip); once one is open, others follow at once. */
  protected showTip(id: string, immediate = false): void {
    clearTimeout(this.tipTimer);
    if (this.tabMenu() || this.addMenu()) return;
    const open = () => this.placeTip(id);
    if (immediate || this.tip()) open();
    else this.tipTimer = setTimeout(open, TIP_DELAY);
  }

  /** Keyboard focus shows it straight away (not on mouse clicks, which focus too). */
  protected onTipFocus(id: string, event: FocusEvent): void {
    if ((event.target as HTMLElement).matches(':focus-visible')) this.showTip(id, true);
  }

  /** Hides the tooltip after `delay` ms (or at once with 0). The delay lets the pointer move onto it. */
  hideTip(delay = TIP_GRACE): void {
    clearTimeout(this.tipTimer);
    if (!delay) this.tip.set(null);
    else this.tipTimer = setTimeout(() => this.tip.set(null), delay);
  }

  /** Pointer moved onto the tooltip: keep it open. */
  protected keepTip(): void {
    clearTimeout(this.tipTimer);
  }

  /** Centered under the tab (or "+"), kept inside the viewport; the caret still points at it. */
  private placeTip(id: string): void {
    const anchor = id === ADD_TIP ? this.host.querySelector('.tab-add') : this.tabButton(id)?.closest('.tab');
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const width = this.host.ownerDocument.defaultView?.innerWidth ?? 1024;
    const center = rect.left + rect.width / 2;
    const left = Math.max(TIP_HALF_WIDTH + 8, Math.min(center, width - TIP_HALF_WIDTH - 8));
    this.tip.set({ id, top: rect.bottom + 8, left, caret: center - left });
  }

  // ------------------------------------------------------------------
  // Global shortcuts: Alt+1…9, Alt+W, Alt+Shift+T
  // `code` (not `key`), so they work with the Arabic keyboard layout too.
  // ------------------------------------------------------------------

  protected onShortcut(event: KeyboardEvent): void {
    if (!event.altKey || event.ctrlKey || event.metaKey) return;
    const views = this.views();
    const digit = /^Digit([1-9])$/.exec(event.code);
    if (digit && !event.shiftKey) {
      // Alt+9 is always the last tab, as in browsers.
      const n = Number(digit[1]);
      const view = n === 9 ? views.at(-1) : views[n - 1];
      if (view) {
        event.preventDefault();
        this.select(view);
      }
    } else if (event.code === 'KeyW' && !event.shiftKey) {
      const active = views.find((v) => v.active);
      if (active && !active.pinned) {
        event.preventDefault();
        this.close(active);
      }
    } else if (event.code === 'KeyT' && event.shiftKey && this.workspace.closed().length) {
      event.preventDefault();
      this.workspace.reopen();
    }
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  /**
   * The page scrolls inside the layout's <main>, which stays put between
   * pages. Park each page's scroll position when leaving it and put it
   * back when its tab is selected again (new pages start at the top).
   */
  private restoreScrollOnTabSwitch(): void {
    const scroller = () => this.host.closest('main');
    let currentPage = this.pageFor(this.router.url);

    this.router.events.pipe(takeUntilDestroyed()).subscribe((e) => {
      if (e instanceof NavigationStart && currentPage) {
        this.pageState.save(scrollKey(currentPage), scroller()?.scrollTop ?? 0);
      }
      if (e instanceof NavigationEnd) {
        const page = this.pageFor(e.urlAfterRedirects);
        if (page === currentPage) return;
        currentPage = page;
        const top = (page && this.pageState.restore<number>(scrollKey(page))) || 0;
        afterNextRender(() => scroller()?.scrollTo({ top }), { injector: this.injector });
      }
    });
  }

  /** The page a URL shows, used to tell whether a navigation changes page or only the request in the panel. */
  private pageFor(url: string): string | null {
    const tab = this.workspace.tabFor(url);
    return tab ? pageOf(tab) : null;
  }

  /** Keep a fixed menu inside the viewport. */
  private fit(x: number, y: number, width: number): MenuPosition {
    const view = this.host.ownerDocument.defaultView;
    const maxLeft = (view?.innerWidth ?? 1024) - width - 8;
    return { left: Math.max(8, Math.min(x, maxLeft)), top: y };
  }

  private tabButton(id: string | null | undefined): HTMLElement | null {
    // Tab ids are plain slugs ("procurement", "request-8"), safe in a selector.
    return id ? this.host.querySelector<HTMLElement>(`[data-tab="${id}"]`) : null;
  }

  private focusTab(id: string | undefined): void {
    afterNextRender(() => this.tabButton(id)?.focus(), { injector: this.injector });
  }

  private focusTabAt(index: number): void {
    afterNextRender(
      () => {
        const id = this.views()[Math.max(0, index)]?.tab.id;
        this.tabButton(id)?.focus();
      },
      { injector: this.injector },
    );
  }

  /** Focuses the first enabled menu item inside `selector` once it is drawn. */
  private focusFirstItem(selector: string): void {
    afterNextRender(() => this.host.querySelector<HTMLElement>(`${selector} [role="menuitem"]:not(:disabled)`)?.focus(), {
      injector: this.injector,
    });
  }
}
