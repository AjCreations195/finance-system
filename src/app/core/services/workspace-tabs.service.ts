import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from './auth.service';
import { PageStateService } from './page-state.service';
import { PurchaseRequestService } from './purchase-request.service';

/** A module (page) that can be open as a tab. `route: null` = module outside this task. */
export interface ModuleDef {
  id: string;
  label: string;
  icon: string;
  route: string | null;
  /** Pinned tabs can't be closed (the dashboard is always there). */
  pinned?: boolean;
}

export const MODULES: readonly ModuleDef[] = [
  { id: 'dashboard', label: 'layout.tabs.dashboard', icon: 'dashboard', route: '/dashboard', pinned: true },
  { id: 'procurement', label: 'layout.tabs.procurement', icon: 'procurement', route: '/procurement/purchase-requests' },
  { id: 'custody', label: 'layout.tabs.custody', icon: 'custody-procedures', route: null },
  { id: 'requests', label: 'layout.tabs.requests', icon: 'tasks', route: null },
  { id: 'invoices', label: 'layout.tabs.invoices', icon: 'receipt', route: null },
  { id: 'contracts', label: 'layout.tabs.contracts', icon: 'file-text', route: null },
  { id: 'budget', label: 'layout.tabs.budget', icon: 'wallet-outline', route: null },
];

/** Page that lists purchase requests; `?view=<id>` opens one in the details panel. */
const REQUESTS_ROUTE = '/procurement/purchase-requests';

/**
 * One open tab:
 *  - module: a page (Dashboard, Purchase request, …)
 *  - record: one purchase request, shown in the details panel over the list
 * `url` is the last URL visited in the tab (with its query), so switching
 * back lands exactly where the user left.
 */
export type WorkspaceTab =
  | { kind: 'module'; id: string; url: string | null }
  | { kind: 'record'; id: string; requestId: number; url: string };

/** Record tabs kept open at most; opening more retires the oldest one. */
export const MAX_RECORD_TABS = 8;
/** Closed tabs remembered for "Reopen closed tab". */
const MAX_CLOSED = 10;

const TABS_KEY = 'fs-workspace-tabs';

interface StoredTabs {
  tabs: WorkspaceTab[];
  closed: WorkspaceTab[];
}

/**
 * WorkspaceTabsService
 * --------------------
 * The open-tabs model behind the tab strip (WorkspaceTabsComponent).
 *
 *  - Follows the router: visiting a page opens (or reopens) its tab, and
 *    opening a purchase request (`?view=8`) opens a record tab for it.
 *  - Each tab remembers its last URL; pages park their UI state in
 *    PageStateService, which is cleared when the tab is closed.
 *  - The open tabs (and recently closed ones) are remembered per user
 *    across sessions, in localStorage.
 */
@Injectable({ providedIn: 'root' })
export class WorkspaceTabsService {
  private readonly router = inject(Router);
  private readonly requests = inject(PurchaseRequestService);
  private readonly auth = inject(AuthService);
  private readonly pageState = inject(PageStateService);

  private readonly _tabs = signal<WorkspaceTab[]>([]);
  private readonly _closed = signal<WorkspaceTab[]>([]);
  readonly tabs = this._tabs.asReadonly();
  readonly closed = this._closed.asReadonly();

  /** Current URL. */
  readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** Id of the tab showing the current URL (null on pages without a tab). */
  readonly activeId = computed(() => this.tabFor(this.url())?.id ?? null);

  private readonly storageKey = computed(() => `${TABS_KEY}:${this.auth.user()?.id ?? 'guest'}`);

  constructor() {
    // Load this user's tabs (again after switching accounts).
    effect(() => {
      const stored = readJson<StoredTabs>(localStorage, this.storageKey());
      untracked(() => {
        this._tabs.set(sanitize(stored?.tabs) ?? defaultTabs());
        this._closed.set(sanitize(stored?.closed, false) ?? []);
        this.track(this.router.url);
      });
    });

    // Remember them.
    effect(() => {
      const data: StoredTabs = { tabs: this._tabs(), closed: this._closed() };
      writeJson(localStorage, this.storageKey(), data);
    });

    // Every navigation opens / updates the tab it belongs to.
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e) => this.track(e.urlAfterRedirects));

    // A deleted request takes its tab with it.
    effect(() => {
      const ids = new Set(this.requests.requests().map((r) => r.id));
      const gone = (t: WorkspaceTab) => t.kind === 'record' && !ids.has(t.requestId);
      if (this._tabs().some(gone)) this._tabs.update((list) => list.filter((t) => !gone(t)));
      if (this._closed().some(gone)) this._closed.update((list) => list.filter((t) => !gone(t)));
    });
  }

  // ------------------------------------------------------------------
  // Tabs
  // ------------------------------------------------------------------

  /** Go to a tab. Returns false for modules outside this task (nothing to open). */
  activate(tab: WorkspaceTab): boolean {
    const url = this.urlOf(tab);
    if (!url) return false;
    void this.router.navigateByUrl(url);
    return true;
  }

  /** Open a module from the "+" menu (adds the tab even if the page isn't available yet). */
  openModule(id: string): boolean {
    const existing = this._tabs().find((t) => t.id === id);
    if (existing) return this.activate(existing);
    const tab: WorkspaceTab = { kind: 'module', id, url: null };
    this.insert(tab);
    this._closed.update((list) => list.filter((t) => t.id !== id));
    return this.activate(tab);
  }

  /** Open a purchase request in its own tab. */
  openRequest(id: number): void {
    void this.router.navigateByUrl(this.router.createUrlTree([REQUESTS_ROUTE], { queryParams: { view: id } }));
  }

  close(id: string): void {
    this.closeMany([id]);
  }

  /** Close every tab except `id` (and the pinned ones). */
  closeOthers(id: string): void {
    this.closeMany(this._tabs().map((t) => t.id).filter((t) => t !== id), id);
  }

  /** Close the tabs after `id` (to its right in English, its left in Arabic). */
  closeAfter(id: string): void {
    const list = this._tabs();
    const index = list.findIndex((t) => t.id === id);
    this.closeMany(list.slice(index + 1).map((t) => t.id), id);
  }

  closeAll(): void {
    this.closeMany(this._tabs().map((t) => t.id));
  }

  /** Bring back the most recently closed tab (or a given one from the menu). */
  reopen(id = this._closed()[0]?.id): void {
    const tab = this._closed().find((t) => t.id === id);
    if (!tab) return;
    this._closed.update((list) => list.filter((t) => t !== tab));
    if (!this._tabs().some((t) => t.id === tab.id)) this.insert(tab);
    this.activate(tab);
  }

  isPinned(tab: WorkspaceTab): boolean {
    return tab.kind === 'module' && !!moduleDef(tab.id)?.pinned;
  }

  /** URL a tab opens: its last visited URL, or the module's home page. */
  urlOf(tab: WorkspaceTab): string | null {
    return tab.url ?? moduleDef(tab.id)?.route ?? null;
  }

  /** Which tab a URL belongs to (null for pages without a tab). */
  tabFor(url: string): WorkspaceTab | null {
    const tree = this.router.parseUrl(url);
    const path = '/' + (tree.root.children['primary']?.segments.map((s) => s.path).join('/') ?? '');
    const view = Number(tree.queryParams['view']);
    if (path.startsWith(REQUESTS_ROUTE) && view > 0) {
      return { kind: 'record', id: `request-${view}`, requestId: view, url };
    }
    const mod = MODULES.find((m) => m.route && path.startsWith(m.route));
    return mod ? { kind: 'module', id: mod.id, url } : null;
  }

  // ------------------------------------------------------------------
  // Internals
  // ------------------------------------------------------------------

  /** Called on every navigation: open the URL's tab if needed and remember its URL. */
  private track(url: string): void {
    const target = this.tabFor(url);
    if (!target) return;
    // Unknown request id (deleted, mistyped link): no tab for it.
    if (target.kind === 'record' && !this.requests.getById(target.requestId)) return;

    const index = this._tabs().findIndex((t) => t.id === target.id);
    if (index >= 0) {
      this._tabs.update((list) => list.map((t, i) => (i === index ? target : t)));
      return;
    }
    this.insert(target);
    this._closed.update((list) => list.filter((t) => t.id !== target.id));
    if (target.kind === 'record') this.retireOldRecords(target.id);
  }

  /**
   * Insert a tab where it belongs: modules in their usual order, record
   * tabs grouped right after "Purchase request".
   */
  private insert(tab: WorkspaceTab): void {
    this._tabs.update((list) => {
      const rank = (t: WorkspaceTab) => (t.kind === 'record' ? moduleIndex('procurement') + 0.5 : moduleIndex(t.id));
      const at = list.findIndex((t) => rank(t) > rank(tab));
      return at < 0 ? [...list, tab] : [...list.slice(0, at), tab, ...list.slice(at)];
    });
  }

  /** Keep at most MAX_RECORD_TABS record tabs; the oldest ones go to "recently closed". */
  private retireOldRecords(keepId: string): void {
    const records: WorkspaceTab[] = this._tabs().filter((t) => t.kind === 'record');
    const extra = records.length - MAX_RECORD_TABS;
    if (extra <= 0) return;
    const retired = records.filter((t) => t.id !== keepId).slice(0, extra);
    this.remember(retired);
    this._tabs.update((list) => list.filter((t) => !retired.includes(t)));
  }

  /**
   * Close tabs. If the active one goes, move to `fallbackId`, or else to the
   * nearest remaining tab that opens a page (the next one, then the previous).
   */
  private closeMany(ids: string[], fallbackId?: string): void {
    const list = this._tabs();
    const closing = list.filter((t) => ids.includes(t.id) && !this.isPinned(t));
    if (!closing.length) return;

    const activeIndex = list.findIndex((t) => t.id === this.activeId());
    const remaining = list.filter((t) => !closing.includes(t));

    this.remember(closing);
    this._tabs.set(remaining);
    // A closed page starts fresh next time.
    const pages = closing.filter((t) => t.kind === 'module').map((t) => t.id);
    if (pages.length) this.pageState.clear(...pages, ...pages.map(scrollKey));

    if (activeIndex < 0 || !closing.includes(list[activeIndex])) return;
    const fallback = remaining.find((t) => t.id === fallbackId);
    const after = list.slice(activeIndex + 1).filter((t) => remaining.includes(t));
    const before = list.slice(0, activeIndex).filter((t) => remaining.includes(t)).reverse();
    const next = [fallback, ...after, ...before].find((t) => t && this.urlOf(t));
    if (next) this.activate(next);
  }

  private remember(tabs: WorkspaceTab[]): void {
    const ids = new Set(tabs.map((t) => t.id));
    this._closed.update((list) => [...[...tabs].reverse(), ...list.filter((t) => !ids.has(t.id))].slice(0, MAX_CLOSED));
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function moduleDef(id: string): ModuleDef | undefined {
  return MODULES.find((m) => m.id === id);
}

/** Page a tab shows: record tabs show the purchase requests list (with the panel open). */
export function pageOf(tab: WorkspaceTab): string {
  return tab.kind === 'record' ? 'procurement' : tab.id;
}

/** PageStateService key for a page's scroll position. */
export function scrollKey(page: string): string {
  return `scroll:${page}`;
}

function moduleIndex(id: string): number {
  return MODULES.findIndex((m) => m.id === id);
}

/** First visit: every module, as in the design. */
function defaultTabs(): WorkspaceTab[] {
  return MODULES.map((m) => ({ kind: 'module', id: m.id, url: null }));
}

/** Drop stored tabs that no longer make sense (removed modules, bad data); always keep pinned modules. */
function sanitize(tabs: WorkspaceTab[] | undefined, keepPinned = true): WorkspaceTab[] | null {
  if (!Array.isArray(tabs)) return null;
  const valid = tabs.filter(
    (t) => (t?.kind === 'module' && !!moduleDef(t.id)) || (t?.kind === 'record' && Number.isInteger(t.requestId) && !!t.url),
  );
  if (!keepPinned) return valid;
  const pinned = MODULES.filter((m) => m.pinned && !valid.some((t) => t.id === m.id)).map<WorkspaceTab>((m) => ({
    kind: 'module',
    id: m.id,
    url: null,
  }));
  return [...pinned, ...valid];
}

function readJson<T>(storage: Storage, key: string): T | null {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(storage: Storage, key: string, value: unknown): void {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: tabs just won't be remembered */
  }
}
