import { Component, DestroyRef, Injector, afterNextRender, computed, inject, signal } from '@angular/core';
import { TASK_STATUSES, TaskItem, TaskStatus } from '../../../../core/models/dashboard.models';
import { DashboardDataService } from '../../../../core/services/dashboard-data.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { DashboardCardComponent } from '../../../../shared/components/dashboard-card/dashboard-card.component';
import { FilterMenuComponent, FilterOption } from '../../../../shared/components/filter-menu/filter-menu.component';
import { LocalDatePipe } from '../../../../shared/pipes/format.pipes';
import { LocalizePipe } from '../../../../shared/pipes/localize.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { TableSort } from '../../../../shared/utils/table-sort';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
const PAGE_SIZE = 5;

/** Icon shown inside each status badge. */
const STATUS_ICONS: Record<TaskStatus, string> = {
  completed: 'done',
  inProgress: 'in-progress',
  executed: 'done',
  review: 'status-review',
  sent: 'done',
  rejected: 'reject',
};
/** Row menu width (matches .row-menu in styles.scss), used to place it. */
const ROW_MENU_WIDTH = 176;

type SortKey = 'number' | 'description' | 'attachments' | 'notes' | 'status' | 'creator' | 'date';

/**
 * MyTasksComponent ("أعمالي")
 * --------------------------
 * The user's work queue: search, status filter, sortable columns,
 * row selection with "select all", row actions and pagination.
 * Data flow (all `computed`): tasks → search/filter → sort → current page.
 *
 * Row actions: Approve and Return apply at once; Reject asks for
 * confirmation; ⋮ opens a menu with Copy task number, Mark as in progress
 * and Delete (with confirmation). View and the task number lead to a module
 * outside this task. Esc closes the top-most layer (dialog, then menu).
 */
@Component({
  selector: 'app-my-tasks',
  imports: [IconComponent, DashboardCardComponent, FilterMenuComponent, TranslatePipe, LocalizePipe, LocalDatePipe],
  templateUrl: './my-tasks.component.html',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'onEscape()',
    '(window:resize)': 'rowMenu.set(null)',
  },
})
export class MyTasksComponent {
  private readonly data = inject(DashboardDataService);
  private readonly language = inject(LanguageService);
  private readonly toast = inject(ToastService);
  private readonly injector = inject(Injector);

  protected readonly statusIcons = STATUS_ICONS;
  protected readonly sort = new TableSort<SortKey>();
  /** Sortable columns, in display order (header text = `tasks.columns.<key>`). */
  protected readonly columns: SortKey[] = ['number', 'description', 'attachments', 'notes', 'status', 'creator', 'date'];

  // ---- UI state ----
  protected readonly search = signal('');
  protected readonly status = signal('all');
  protected readonly page = signal(1);
  protected readonly selected = signal<Set<number>>(new Set());

  /** Row "⋮" menu: which task, and where (fixed position under the button). */
  protected readonly rowMenu = signal<{ task: TaskItem; top: number; left: number } | null>(null);
  /** Tasks waiting for confirmation (null = dialog closed). */
  protected readonly pendingReject = signal<TaskItem | null>(null);
  protected readonly pendingDelete = signal<TaskItem | null>(null);

  /** The ⋮ button that opened the row menu; focus goes back to it. */
  private rowMenuTrigger: HTMLElement | null = null;

  constructor() {
    // The page scrolls inside the layout, not the window: close the fixed row menu on any scroll.
    const closeMenu = () => this.rowMenu.set(null);
    document.addEventListener('scroll', closeMenu, { capture: true, passive: true });
    inject(DestroyRef).onDestroy(() => document.removeEventListener('scroll', closeMenu, { capture: true }));
  }

  protected readonly statusOptions: FilterOption[] = [
    { value: 'all', label: 'common.all' },
    ...TASK_STATUSES.map((s) => ({ value: s, label: `tasks.status.${s}` })),
  ];

  // ---- Derived rows ----
  private readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const status = this.status();
    const lang = this.language.lang();
    return this.data.tasks().filter(
      (t) =>
        (status === 'all' || t.status === status) &&
        (!q ||
          t.number.toLowerCase().includes(q) ||
          t.description[lang].toLowerCase().includes(q) ||
          t.creator.name[lang].toLowerCase().includes(q)),
    );
  });

  private readonly sorted = computed(() => {
    const lang = this.language.lang();
    return this.sort.apply(this.filtered(), {
      number: (t) => t.number,
      description: (t) => t.description[lang],
      attachments: (t) => t.attachments,
      notes: (t) => t.notes,
      status: (t) => t.status,
      creator: (t) => t.creator.name[lang],
      date: (t) => t.date,
    });
  });

  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.sorted().length / PAGE_SIZE)));
  /** Clamped so filtering can't leave you on an empty page. */
  protected readonly currentPage = computed(() => Math.min(this.page(), this.totalPages()));
  protected readonly rows = computed(() => {
    const start = (this.currentPage() - 1) * PAGE_SIZE;
    return this.sorted().slice(start, start + PAGE_SIZE);
  });

  protected readonly allOnPageSelected = computed(() => this.rows().length > 0 && this.rows().every((r) => this.selected().has(r.id)));

  // ---- Handlers ----
  protected onSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
  }

  protected onStatus(value: string): void {
    this.status.set(value);
    this.page.set(1);
  }

  protected goTo(page: number): void {
    this.page.set(Math.min(Math.max(1, page), this.totalPages()));
  }

  protected toggleRow(id: number): void {
    this.selected.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected toggleAllOnPage(): void {
    const ids = this.rows().map((r) => r.id);
    const selectAll = !this.allOnPageSelected();
    this.selected.update((set) => {
      const next = new Set(set);
      ids.forEach((id) => (selectAll ? next.add(id) : next.delete(id)));
      return next;
    });
  }

  // ---- Row actions ----
  protected approve(task: TaskItem): void {
    this.data.setTaskStatus(task.id, 'completed');
    this.toast.show(this.language.translate('tasks.toast.approved', { number: task.number }), 'success');
  }

  protected returnTask(task: TaskItem): void {
    this.data.setTaskStatus(task.id, 'review');
    this.toast.show(this.language.translate('tasks.toast.returned', { number: task.number }), 'info');
  }

  protected askReject(task: TaskItem): void {
    this.pendingReject.set(task);
    this.focusDialog();
  }

  protected confirmReject(): void {
    const task = this.pendingReject();
    if (!task) return;
    this.data.setTaskStatus(task.id, 'rejected');
    this.pendingReject.set(null);
    this.toast.show(this.language.translate('tasks.toast.rejected', { number: task.number }), 'info');
  }

  /** View / task number: the task module is outside this task. */
  protected notAvailable(): void {
    this.toast.show(this.language.translate('login.featureNotAvailable'), 'info');
  }

  // ---- Row menu (⋮) ----
  protected openRowMenu(task: TaskItem, event: MouseEvent): void {
    event.stopPropagation();
    if (this.rowMenu()?.task.id === task.id) {
      this.rowMenu.set(null);
      return;
    }
    // Under the ⋮ button, extending toward the table.
    this.rowMenuTrigger = event.currentTarget as HTMLElement;
    const rect = this.rowMenuTrigger.getBoundingClientRect();
    const left = this.language.isRtl() ? rect.left : rect.right - ROW_MENU_WIDTH;
    this.rowMenu.set({ task, top: rect.bottom + 4, left: Math.max(8, left) });
    // First visible, enabled item (phone-only items are hidden on wider screens)
    afterNextRender(() => {
      const items = document.querySelectorAll<HTMLButtonElement>('.row-menu [role="menuitem"]:not(:disabled)');
      (Array.from(items).find((b) => b.offsetParent !== null) ?? items[0])?.focus();
    }, { injector: this.injector });
  }

  protected copyNumber(task: TaskItem): void {
    this.closeRowMenu();
    const done = () => this.toast.show(this.language.translate('tasks.toast.numberCopied'), 'success');
    const fail = () => this.toast.show(this.language.translate('requests.details.copyFailed'), 'danger');
    if (!navigator.clipboard) {
      fail();
      return;
    }
    navigator.clipboard.writeText(task.number).then(done, fail);
  }

  protected markInProgress(task: TaskItem): void {
    this.closeRowMenu();
    this.data.setTaskStatus(task.id, 'inProgress');
    this.toast.show(this.language.translate('tasks.toast.inProgress', { number: task.number }), 'info');
  }

  protected askDelete(task: TaskItem): void {
    this.rowMenu.set(null);
    this.pendingDelete.set(task);
    this.focusDialog();
  }

  protected confirmDelete(): void {
    const task = this.pendingDelete();
    if (!task) return;
    this.data.deleteTask(task.id);
    this.selected.update((set) => new Set([...set].filter((id) => id !== task.id)));
    this.pendingDelete.set(null);
    this.toast.show(this.language.translate('tasks.toast.deleted', { number: task.number }), 'success');
  }

  // ---- Closing layers ----
  protected onDocumentClick(event: MouseEvent): void {
    if (this.rowMenu() && !(event.target as HTMLElement).closest('.row-menu')) this.rowMenu.set(null);
  }

  /** Esc closes the top-most layer only: a dialog first, then the row menu. */
  protected onEscape(): void {
    if (this.pendingReject() || this.pendingDelete()) {
      this.pendingReject.set(null);
      this.pendingDelete.set(null);
    } else if (this.rowMenu()) {
      this.closeRowMenu();
    }
  }

  protected closeRowMenu(): void {
    this.rowMenu.set(null);
    this.rowMenuTrigger?.focus();
  }

  /** Confirmation dialogs open with focus on their confirm button. */
  private focusDialog(): void {
    afterNextRender(() => document.querySelector<HTMLElement>('.confirm-modal .btn-danger')?.focus(), { injector: this.injector });
  }

  /** Two-digit display used in the design ("01", "08"). */
  protected pad(n: number): string {
    return String(n).padStart(2, '0');
  }
}
