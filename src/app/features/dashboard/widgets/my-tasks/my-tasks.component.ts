import { Component, computed, inject, signal } from '@angular/core';
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
};

type SortKey = 'number' | 'description' | 'attachments' | 'notes' | 'status' | 'creator' | 'date';

/**
 * MyTasksComponent ("أعمالي")
 * --------------------------
 * The user's work queue: search, status filter, sortable columns,
 * row selection with "select all", row actions and pagination.
 * Data flow (all `computed`): tasks → search/filter → sort → current page.
 */
@Component({
  selector: 'app-my-tasks',
  imports: [IconComponent, DashboardCardComponent, FilterMenuComponent, TranslatePipe, LocalizePipe, LocalDatePipe],
  templateUrl: './my-tasks.component.html',
})
export class MyTasksComponent {
  private readonly data = inject(DashboardDataService);
  private readonly language = inject(LanguageService);
  private readonly toast = inject(ToastService);

  protected readonly statusIcons = STATUS_ICONS;
  protected readonly sort = new TableSort<SortKey>();
  /** Sortable columns, in display order (header text = `tasks.columns.<key>`). */
  protected readonly columns: SortKey[] = ['number', 'description', 'attachments', 'notes', 'status', 'creator', 'date'];

  // ---- UI state ----
  protected readonly search = signal('');
  protected readonly status = signal('all');
  protected readonly page = signal(1);
  protected readonly selected = signal<Set<number>>(new Set());

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

  protected notAvailable(): void {
    this.toast.show(this.language.translate('login.featureNotAvailable'), 'info');
  }

  /** Two-digit display used in the design ("01", "08"). */
  protected pad(n: number): string {
    return String(n).padStart(2, '0');
  }
}
