import { Location } from '@angular/common';
import { Component, DOCUMENT, ElementRef, Injector, afterNextRender, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { fromEvent, map } from 'rxjs';
import {
  FINAL_STATUSES,
  PurchaseRequest,
  REQUEST_STATUSES,
  RequestTab,
  STATUS_BADGE,
  STATUS_ICON,
  TAB_STATUSES,
} from '../../core/models/purchase-request.model';
import { LanguageService } from '../../core/services/language.service';
import { PageStateService } from '../../core/services/page-state.service';
import { PurchaseRequestService } from '../../core/services/purchase-request.service';
import { ToastService } from '../../core/services/toast.service';
import { FilterMenuComponent, FilterOption } from '../../shared/components/filter-menu/filter-menu.component';
import { StatCarouselComponent } from '../../shared/components/stat-carousel/stat-carousel.component';
import { LocalDatePipe } from '../../shared/pipes/format.pipes';
import { LocalizePipe } from '../../shared/pipes/localize.pipe';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { TableSort } from '../../shared/utils/table-sort';
import { RequestDetailsComponent } from './request-details/request-details.component';
import { IconComponent } from '../../shared/components/icon/icon.component';

type SortKey = 'number' | 'budgetItem' | 'description' | 'products' | 'notes' | 'status' | 'creator' | 'date';

/** Rows per page. */
const PAGE_SIZE = 10;

/** List state kept while the page's workspace tab is in the background (PageStateService key: the tab id). */
const STATE_KEY = 'procurement';

interface ListState {
  tab: RequestTab;
  status: string;
  search: string;
  page: number;
  sortKey: SortKey | null;
  sortDir: 'asc' | 'desc';
  selected: number[];
}

/** Position of the row action menu (it's `position: fixed`, so it isn't clipped by the scrolling table). */
interface MenuState {
  request: PurchaseRequest;
  top: number;
  left: number;
}

/**
 * PurchaseOrdersComponent ("طلب مشتريات")
 * ------------------------------------
 * The task's Purchase Orders page. The Figma design titles it "Purchase
 * requests", so the UI text, data model and service use that name.
 * Built from the design:
 *
 *  1. Header card: title, description, "Create request"
 *  2. Main card:
 *     - status tabs (All / Fully completed / Partially / Under procedure / Rejected)
 *     - filter (exact status) + search
 *     - summary cards (shared StatCarouselComponent)
 *     - responsive table (.table-responsive) with selection, sorting, row menu
 *     - pagination
 *  3. Sticky bottom action bar: Create, Send, Actions ▾ | Print, Back
 *
 * Row actions: View, Approve, Delete (with confirmation).
 * Data flow (all `computed`): requests → tab → filter → search → sort → page.
 */
@Component({
  selector: 'app-purchase-orders',
  imports: [IconComponent, StatCarouselComponent, FilterMenuComponent, RequestDetailsComponent, TranslatePipe, LocalizePipe, LocalDatePipe],
  templateUrl: './purchase-orders.component.html',
  styleUrl: './purchase-orders.component.scss',
  host: {
    '(document:click)': 'closeMenus()',
    '(document:keydown.escape)': 'onEscape()',
    '(window:resize)': 'rowMenu.set(null)',
    '(window:beforeprint)': 'stampPrintTime()',
  },
})
export class PurchaseOrdersComponent {
  // Services and framework helpers used by the page.
  protected readonly service = inject(PurchaseRequestService);
  private readonly language = inject(LanguageService);
  protected readonly toast = inject(ToastService);
  private readonly location = inject(Location);
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly doc = inject(DOCUMENT);
  /** The page's own element; used to find dialogs and buttons inside it. */
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;

  /** Badge colour per status, and icon per status (see STATUS_BADGE / STATUS_ICON). */
  protected readonly badge = STATUS_BADGE;
  protected readonly statusIcon = STATUS_ICON;
  /** Status tabs above the table, in display order. */
  protected readonly tabs: RequestTab[] = ['all', 'fullyCompleted', 'partiallyCompleted', 'inProgress', 'rejected'];
  /** Columns that can be sorted, in display order. */
  protected readonly columns: SortKey[] = ['number', 'budgetItem', 'description', 'products', 'notes', 'status', 'creator', 'date'];
  /** Column sort state (click a header to sort; see TableSort). */
  protected readonly sort = new TableSort<SortKey>();

  // ------------------------------------------------------------------
  // UI state
  // ------------------------------------------------------------------
  /** Active status tab. */
  protected readonly tab = signal<RequestTab>('all');
  /** Exact-status filter from the "Filter" menu ('all' = no filter). */
  protected readonly status = signal('all');
  /** Search text (matches number, description, budget item, code or creator). */
  protected readonly search = signal('');
  /** Current table page, starting at 1. */
  protected readonly page = signal(1);
  /** Ids of the rows ticked for bulk actions. */
  protected readonly selected = signal<Set<number>>(new Set());
  /** Full-screen mode of the table card. */
  protected readonly expanded = signal(false);

  /** Open row menu (null = closed). */
  protected readonly rowMenu = signal<MenuState | null>(null);
  /** Bottom-bar "Actions" dropdown. */
  protected readonly actionsOpen = signal(false);
  /** Requests waiting for delete confirmation (null = dialog closed). */
  protected readonly pendingDelete = signal<PurchaseRequest[] | null>(null);
  /** Bulk approve waiting for confirmation: the requests to approve + the finalised ones that will be skipped. */
  protected readonly pendingApprove = signal<{ requests: PurchaseRequest[]; skippedIds: number[] } | null>(null);

  /**
   * Request shown in the details panel. The id lives in the URL (?view=8),
   * so refresh, back/forward and shared links all reopen the same request.
   */
  private readonly viewId = toSignal(this.route.queryParamMap.pipe(map((p) => Number(p.get('view')) || null)), {
    initialValue: null,
  });
  protected readonly viewing = computed(() => {
    const id = this.viewId();
    return id ? (this.service.getById(id) ?? null) : null;
  });
  /** Element that opened the panel, focused again when it closes. */
  private panelOpener: HTMLElement | null = null;
  /** The ⋮ button of the open row menu. */
  private rowMenuTrigger: HTMLElement | null = null;

  /** Options of the "Filter" menu: All, then one entry per exact status. */
  protected readonly statusOptions: FilterOption[] = [
    { value: 'all', label: 'common.all' },
    ...REQUEST_STATUSES.map((s) => ({ value: s, label: `requests.status.${s}` })),
  ];

  // ------------------------------------------------------------------
  // Derived data: tab → filter → search → sort → page
  // ------------------------------------------------------------------
  /** Requests that pass the tab, the status filter and the search text. */
  private readonly filtered = computed(() => {
    const tab = this.tab();
    const status = this.status();
    const q = this.search().trim().toLowerCase();
    const lang = this.language.lang();

    return this.service.requests().filter((r) => {
      const inTab = tab === 'all' || TAB_STATUSES[tab].includes(r.status);
      const matchesStatus = status === 'all' || r.status === status;
      const matchesSearch =
        !q ||
        r.number.toLowerCase().includes(q) ||
        r.description[lang].toLowerCase().includes(q) ||
        r.budgetItem.name[lang].toLowerCase().includes(q) ||
        r.budgetItem.code.includes(q) ||
        r.creator.name[lang].toLowerCase().includes(q);
      return inTab && matchesStatus && matchesSearch;
    });
  });

  /** The filtered requests in the chosen column order. */
  private readonly sorted = computed(() => this.sortList(this.filtered()));

  /** Applies the current column sort to any list of requests. */
  private sortList(list: PurchaseRequest[]): PurchaseRequest[] {
    const lang = this.language.lang();
    return this.sort.apply(list, {
      number: (r) => r.number,
      budgetItem: (r) => r.budgetItem.name[lang],
      description: (r) => r.description[lang],
      products: (r) => r.products,
      notes: (r) => r.notes,
      status: (r) => this.language.translate(`requests.status.${r.status}`),
      creator: (r) => r.creator.name[lang],
      date: (r) => r.date,
    });
  }

  /** Number of pages (at least 1). */
  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.sorted().length / PAGE_SIZE)));
  /** Clamped, so deleting or filtering can't leave you on an empty page. */
  protected readonly currentPage = computed(() => Math.min(this.page(), this.totalPages()));
  /** The rows shown on the current page. */
  protected readonly rows = computed(() => {
    const start = (this.currentPage() - 1) * PAGE_SIZE;
    return this.sorted().slice(start, start + PAGE_SIZE);
  });

  /** True when every row on this page is ticked (drives the header checkbox). */
  protected readonly allOnPageSelected = computed(() => this.rows().length > 0 && this.rows().every((r) => this.selected().has(r.id)));
  /** How many rows are ticked. */
  protected readonly selectedCount = computed(() => this.selected().size);

  // ------------------------------------------------------------------
  // Print report (print-only markup, hidden on screen)
  // ------------------------------------------------------------------
  /** Ticked rows if there are any, otherwise every row matching the filters (all pages). */
  protected readonly printRows = computed(() => (this.selectedCount() ? this.sortList(this.selectedRequests()) : this.sorted()));

  /** Summary line under the report title, e.g. "Rejected · Search: "cables"". */
  protected readonly printFilters = computed(() => {
    if (this.selectedCount()) return [this.language.translate('requests.printReport.selectedOnly')];
    const parts = [this.language.translate(`requests.tabs.${this.tab()}`)];
    if (this.status() !== 'all') {
      const status = this.language.translate(`requests.status.${this.status()}`);
      parts.push(this.language.translate('requests.printReport.status', { status }));
    }
    const query = this.search().trim();
    if (query) parts.push(this.language.translate('requests.printReport.search', { query }));
    return parts;
  });

  /** Set when printing starts (button or Ctrl+P), shown in the report header. */
  protected readonly printedAt = signal(new Date());
  /** The print time, formatted for the current language and locale. */
  protected readonly printedAtLabel = computed(() =>
    new Intl.DateTimeFormat(this.language.locale(), { dateStyle: 'medium', timeStyle: 'short' }).format(this.printedAt()),
  );

  constructor() {
    // Coming back to the tab: pick up where the user left (filters, sort, page, selection).
    // The state is saved again on every change, so it survives leaving the tab.
    const pageState = inject(PageStateService);
    this.restoreState(pageState.restore<ListState>(STATE_KEY));
    effect(() => {
      const state: ListState = {
        tab: this.tab(),
        status: this.status(),
        search: this.search(),
        page: this.page(),
        sortKey: this.sort.key(),
        sortDir: this.sort.dir(),
        selected: [...this.selected()],
      };
      pageState.save(STATE_KEY, state);
    });

    // "View all" in the navbar search arrives as ?q=term: show every request matching
    // it (clearing tab / status filters that could hide some), then drop q from the URL.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const q = params.get('q');
      if (q === null) return;
      this.tab.set('all');
      this.status.set('all');
      this.onSearch(q);
      this.router.navigate([], { relativeTo: this.route, queryParams: { q: null }, queryParamsHandling: 'merge', replaceUrl: true });
    });

    // Lock page scrolling while the table card is in full-screen mode.
    const doc = inject(DOCUMENT);
    // (also while the details panel is open)
    effect(() => doc.body.classList.toggle('overflow-hidden', this.expanded() || !!this.viewing()));

    // Close the row menu on any scroll. The page scrolls inside the layout,
    // not the window, and scroll events don't bubble, so listen in capture.
    fromEvent(doc, 'scroll', { capture: true })
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.rowMenu.set(null));
  }

  /** Apply saved list state, ignoring anything that no longer fits (e.g. a removed tab or column). */
  private restoreState(saved: ListState | undefined): void {
    if (!saved) return;
    if (this.tabs.includes(saved.tab)) this.tab.set(saved.tab);
    if (this.statusOptions.some((o) => o.value === saved.status)) this.status.set(saved.status);
    if (typeof saved.search === 'string') this.search.set(saved.search);
    if (Number.isInteger(saved.page) && saved.page > 0) this.page.set(saved.page);
    if (saved.sortKey && this.columns.includes(saved.sortKey)) {
      this.sort.key.set(saved.sortKey);
      this.sort.dir.set(saved.sortDir === 'desc' ? 'desc' : 'asc');
    }
    if (Array.isArray(saved.selected)) {
      // Only requests that still exist.
      const ids = new Set(this.service.requests().map((r) => r.id));
      this.selected.set(new Set(saved.selected.filter((id) => ids.has(id))));
    }
  }

  // ------------------------------------------------------------------
  // Filters (each resets to page 1)
  // ------------------------------------------------------------------
  /** Switches the status tab and returns to page 1. */
  protected setTab(tab: RequestTab): void {
    this.tab.set(tab);
    this.page.set(1);
  }

  /**
   * Summary card → table tab it summarises (the balance card shows everything).
   * The card ids come from StatCarouselComponent's `statSelect` output.
   */
  private readonly statTabs: Record<string, RequestTab> = {
    available: 'all',
    posted: 'fullyCompleted',
    inProgress: 'inProgress',
    rejected: 'rejected',
  };

  /** Card highlighted for the current tab (none for "Partially completed", which has no card). */
  protected readonly activeStat = computed(() => Object.keys(this.statTabs).find((id) => this.statTabs[id] === this.tab()) ?? null);

  /**
   * Clicking a card shows its requests in the table; clicking the active one
   * again goes back to all requests. The exact-status filter is cleared so
   * it can't hide the card's requests.
   */
  protected selectStat(id: string): void {
    const tab = this.statTabs[id];
    if (!tab) return;
    this.setStatus('all');
    this.setTab(tab === this.tab() && tab !== 'all' ? 'all' : tab);
  }

  /** Sets the exact-status filter and returns to page 1. */
  protected setStatus(value: string): void {
    this.status.set(value);
    this.page.set(1);
  }

  /** Sets the search text and returns to page 1. */
  protected onSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
  }

  /** Moves to a page, kept between 1 and the last page. */
  protected goTo(page: number): void {
    this.page.set(Math.min(Math.max(1, page), this.totalPages()));
  }

  // ------------------------------------------------------------------
  // Selection
  // ------------------------------------------------------------------
  /** Ticks or unticks one row. */
  protected toggleRow(id: number): void {
    this.selected.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Ticks every row on this page, or clears them if they are all ticked already. */
  protected toggleAllOnPage(): void {
    const ids = this.rows().map((r) => r.id);
    const selectAll = !this.allOnPageSelected();
    this.selected.update((set) => {
      const next = new Set(set);
      ids.forEach((id) => (selectAll ? next.add(id) : next.delete(id)));
      return next;
    });
  }

  // ------------------------------------------------------------------
  // Row menu (View / Approve / Delete)
  // ------------------------------------------------------------------
  /** Opens the ⋮ menu of a row, or closes it if that row's menu is already open. */
  protected openRowMenu(request: PurchaseRequest, event: MouseEvent): void {
    event.stopPropagation();
    if (this.rowMenu()?.request.id === request.id) {
      this.rowMenu.set(null);
      return;
    }
    // Place the menu under the ⋮ button, extending toward the page content.
    this.rowMenuTrigger = event.currentTarget as HTMLElement;
    const rect = this.rowMenuTrigger.getBoundingClientRect();
    const menuWidth = 176;
    const left = this.language.isRtl() ? rect.left : rect.right - menuWidth;
    this.rowMenu.set({ request, top: rect.bottom + 4, left: Math.max(8, left) });
  }

  /** A request can be approved until it reaches a final status (see FINAL_STATUSES). */
  protected canApprove(request: PurchaseRequest): boolean {
    return !FINAL_STATUSES.includes(request.status);
  }

  // ------------------------------------------------------------------
  // Details panel
  // ------------------------------------------------------------------
  /** Opens the details panel (row number link or row menu → View). */
  protected view(request: PurchaseRequest): void {
    // The row menu's View item disappears with the menu, so return focus to the row's ⋮ button instead.
    const active = this.doc.activeElement as HTMLElement | null;
    this.panelOpener = active?.closest('.row-menu') ? this.rowMenuTrigger : active;
    this.rowMenu.set(null);
    this.router.navigate([], { relativeTo: this.route, queryParams: { view: request.id }, queryParamsHandling: 'merge' });
  }

  /** Closes the details panel (removes ?view from the URL) and returns focus to the element that opened it. */
  protected closeDetails(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { view: null }, queryParamsHandling: 'merge', replaceUrl: true });
    const opener = this.panelOpener;
    this.panelOpener = null;
    if (opener?.isConnected) afterNextRender(() => opener.focus(), { injector: this.injector });
  }

  /** Approve / approve & send from the panel (one request, so no confirmation, like the row menu). */
  protected approveFromDetails(status: 'accepted' | 'sent'): void {
    const request = this.viewing();
    if (!request || !this.canApprove(request)) return;
    this.service.setStatus([request.id], status);
    const key = status === 'sent' ? 'requests.details.approvedAndSent' : 'requests.toast.approved';
    this.toast.show(this.language.translate(key, { number: request.number }), 'success');
  }

  /** Delete from the panel: goes through the same confirmation dialog as the row menu. */
  protected deleteFromDetails(): void {
    const request = this.viewing();
    if (request) this.askDelete([request]);
  }

  /** Approves one request from its row menu (no confirmation). */
  protected approve(request: PurchaseRequest): void {
    this.rowMenu.set(null);
    this.service.setStatus([request.id], 'accepted');
    this.toast.show(this.language.translate('requests.toast.approved', { number: request.number }), 'success');
  }

  /** Opens the delete confirmation for the given requests (no-op for an empty list). */
  protected askDelete(requests: PurchaseRequest[]): void {
    this.rowMenu.set(null);
    this.actionsOpen.set(false);
    if (!requests.length) return;
    this.pendingDelete.set(requests);
    this.focusDialog('.btn-danger');
  }

  /** Confirmation dialogs open with focus on their confirm button (as in the dashboard widgets). */
  private focusDialog(button: string): void {
    afterNextRender(() => this.host.querySelector<HTMLElement>(`.confirm-modal ${button}`)?.focus(), { injector: this.injector });
  }

  /** Deletes the requests in the open confirmation, and removes them from the selection. */
  protected confirmDelete(): void {
    const list = this.pendingDelete();
    if (!list) return;
    const ids = list.map((r) => r.id);
    // Deleting the request that's open in the panel closes the panel.
    const openId = this.viewing()?.id;
    if (openId && ids.includes(openId)) this.closeDetails();
    this.service.delete(ids);
    this.selected.update((set) => new Set([...set].filter((id) => !ids.includes(id))));
    this.pendingDelete.set(null);
    this.toast.show(
      list.length === 1
        ? this.language.translate('requests.toast.deleted', { number: list[0].number })
        : this.language.translate('requests.toast.deletedMany', { count: list.length }),
      'success',
    );
  }

  // ------------------------------------------------------------------
  // Bottom action bar
  // ------------------------------------------------------------------
  private selectedRequests(): PurchaseRequest[] {
    const ids = this.selected();
    return this.service.requests().filter((r) => ids.has(r.id));
  }

  /** Runs `action` on the selection, or asks the user to select something first. */
  private withSelection(action: (list: PurchaseRequest[]) => void): void {
    this.actionsOpen.set(false);
    const list = this.selectedRequests();
    if (!list.length) {
      this.toast.show(this.language.translate('requests.noSelection'), 'warning');
      return;
    }
    action(list);
  }

  /**
   * Sends every ticked request ("sent" status), then clears the selection.
   * Bulk actions clear the rows they handled from the selection, so the same
   * action can't be repeated on them by accident. Rows that were skipped stay
   * selected, so the user can see which ones need attention.
   */
  protected sendSelected(): void {
    this.withSelection((list) => {
      this.service.setStatus(list.map((r) => r.id), 'sent');
      this.selected.set(new Set());
      this.toast.show(this.language.translate('requests.toast.sent', { count: list.length }), 'success');
    });
  }

  /** Bulk approve asks for confirmation first (single-row approve from the row menu doesn't). */
  protected approveSelected(): void {
    this.withSelection((list) => {
      const approvable = list.filter((r) => this.canApprove(r));
      if (!approvable.length) {
        this.toast.show(this.language.translate('requests.toast.noneApprovable'), 'warning');
        return;
      }
      const skippedIds = list.filter((r) => !this.canApprove(r)).map((r) => r.id);
      this.pendingApprove.set({ requests: approvable, skippedIds });
      this.focusDialog('.confirm-approve');
    });
  }

  /** Approves the requests in the open bulk-approve dialog. Skipped (already final) rows stay selected. */
  protected confirmApprove(): void {
    const pending = this.pendingApprove();
    if (!pending) return;
    const { requests, skippedIds } = pending;
    const skipped = skippedIds.length;
    this.service.setStatus(requests.map((r) => r.id), 'accepted');
    this.selected.set(new Set(skippedIds));
    this.pendingApprove.set(null);
    this.toast.show(
      skipped
        ? this.language.translate('requests.toast.approvedSomeSkipped', { count: requests.length, skipped })
        : this.language.translate('requests.toast.approvedMany', { count: requests.length }),
      skipped ? 'warning' : 'success',
    );
  }

  /** Asks to delete every ticked request. */
  protected deleteSelected(): void {
    this.withSelection((list) => this.askDelete(list));
  }

  /** Opens or closes the bottom bar's "Actions" menu. */
  protected toggleActions(event: MouseEvent): void {
    event.stopPropagation();
    this.actionsOpen.update((o) => !o);
  }

  /** Records when printing started; also runs on Ctrl+P through `beforeprint`. */
  protected stampPrintTime(): void {
    this.printedAt.set(new Date());
  }

  /** Prints the report: refresh its timestamp, let it render, then open the print dialog. */
  protected print(): void {
    this.actionsOpen.set(false);
    this.stampPrintTime();
    afterNextRender(() => window.print(), { injector: this.injector });
  }

  /** Goes back to the previous page in the browser history. */
  protected back(): void {
    this.location.back();
  }

  /** Closes the row menu and the Actions menu. */
  protected closeMenus(): void {
    this.rowMenu.set(null);
    this.actionsOpen.set(false);
  }

  /** Esc closes the top-most layer only: a dialog first, then the details panel, then the rest. */
  protected onEscape(): void {
    if (this.pendingDelete() || this.pendingApprove()) {
      this.pendingDelete.set(null);
      this.pendingApprove.set(null);
      return;
    }
    if (this.viewing()) {
      this.closeDetails();
      return;
    }
    this.closeMenus();
    if (this.expanded()) this.setExpanded(false);
  }

  /**
   * Full-screen table card on / off. Focus follows the control that's
   * visible: the card's "Exit full screen" button, then the header's expand
   * button again (the full-screen card covers the header).
   */
  protected setExpanded(on: boolean): void {
    this.expanded.set(on);
    const target = on ? '.collapse-btn' : '.expand-btn';
    afterNextRender(() => this.host.querySelector<HTMLElement>(target)?.focus(), { injector: this.injector });
  }
}
