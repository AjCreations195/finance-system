import { Component, computed, inject, signal } from '@angular/core';
import { DashboardDataService } from '../../../core/services/dashboard-data.service';
import { LanguageService } from '../../../core/services/language.service';
import { ToastService } from '../../../core/services/toast.service';
import { LocalizePipe } from '../../../shared/pipes/localize.pipe';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { FilterOption } from '../../../shared/components/filter-menu/filter-menu.component';
import { SelectMenuComponent } from '../../../shared/components/select-menu/select-menu.component';

/**
 * NotificationsMenuComponent
 * --------------------------
 * Bell button + dropdown panel (shown at the top of the Figma frame).
 * Lists purchase-request notifications with optional actions
 * (Approve / Reject), attachments and comments.
 * A red dot on the bell shows when there are unread items.
 */
@Component({
  selector: 'app-notifications-menu',
  imports: [TranslatePipe, LocalizePipe, IconComponent, SelectMenuComponent],
  templateUrl: './notifications-menu.component.html',
  styleUrl: './notifications-menu.component.scss',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'open.set(false)',
  },
})
export class NotificationsMenuComponent {
  protected readonly data = inject(DashboardDataService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  /** Whether the dropdown panel is visible. */
  protected readonly open = signal(false);
  /** Filter tabs inside the panel. */
  protected readonly filter = signal<'all' | 'unread'>('all');
  /** Options of the filter menu (labels are translation keys). */
  protected readonly filterOptions: FilterOption[] = [
    { value: 'all', label: 'notifications.all' },
    { value: 'unread', label: 'notifications.unread' },
  ];

  /** The notifications to list, after the filter is applied. */
  protected readonly items = computed(() =>
    this.filter() === 'unread' ? this.data.notifications().filter((n) => n.unread) : this.data.notifications(),
  );

  /** Opens or closes the panel. stopPropagation stops the document click handler from closing it at once. */
  protected toggle(event: MouseEvent): void {
    event.stopPropagation();
    this.open.update((o) => !o);
  }

  /** Close when clicking anywhere outside the panel. */
  protected onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (this.open() && !target.closest('.notif-panel')) this.open.set(false);
  }

  /**
   * Approve / Reject buttons: demo feedback and remove the item. Both are
   * completed actions, so both get the green success toast (red is for failures).
   */
  protected act(id: number, action: 'approve' | 'reject'): void {
    this.data.dismissNotification(id);
    this.toast.show(this.language.translate(action === 'reject' ? 'notifications.rejected' : 'notifications.approvedToast'), 'success');
  }

  /** "Today at 9:42 AM" / "Yesterday at 5:42 PM" / "12 Oct at 9:42 AM", as in the design. */
  protected timeLabel(iso: string): string {
    const date = new Date(iso);
    const t = (key: string, params?: Record<string, string>) => this.language.translate(key, params);
    const hours = date.getHours();
    const time = `${hours % 12 || 12}:${String(date.getMinutes()).padStart(2, '0')} ${t(hours < 12 ? 'notifications.am' : 'notifications.pm')}`;

    const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const days = Math.round((startOf(new Date()) - startOf(date)) / 86_400_000);
    if (days === 0) return t('notifications.todayAt', { time });
    if (days === 1) return t('notifications.yesterdayAt', { time });
    const day = new Intl.DateTimeFormat(this.language.locale(), { day: 'numeric', month: 'short' }).format(date);
    return t('notifications.dateAt', { date: day, time });
  }
}
