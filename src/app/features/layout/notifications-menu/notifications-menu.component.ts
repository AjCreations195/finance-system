import { Component, computed, inject, signal } from '@angular/core';
import { DashboardDataService } from '../../../core/services/dashboard-data.service';
import { LanguageService } from '../../../core/services/language.service';
import { ToastService } from '../../../core/services/toast.service';
import { LocalDatePipe } from '../../../shared/pipes/format.pipes';
import { LocalizePipe } from '../../../shared/pipes/localize.pipe';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { IconComponent } from '../../../shared/components/icon/icon.component';

/**
 * NotificationsMenuComponent
 * --------------------------
 * Bell button + dropdown panel (shown at the top of the Figma frame).
 * Lists purchase-request notifications with optional actions
 * (Review / Reject), attachments and comments.
 * A red dot on the bell shows when there are unread items.
 */
@Component({
  selector: 'app-notifications-menu',
  imports: [TranslatePipe, LocalizePipe, LocalDatePipe, IconComponent],
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

  protected readonly open = signal(false);
  /** Filter tabs inside the panel. */
  protected readonly filter = signal<'all' | 'unread'>('all');

  protected readonly items = computed(() =>
    this.filter() === 'unread' ? this.data.notifications().filter((n) => n.unread) : this.data.notifications(),
  );

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
   * Review / Reject buttons: demo feedback and remove the item.
   * A successful reject is a completed action, so it gets the green success
   * toast (red is reserved for failures).
   */
  protected act(id: number, action: 'review' | 'reject'): void {
    this.data.dismissNotification(id);
    if (action === 'reject') {
      this.toast.show(this.language.translate('notifications.rejected'), 'success');
    } else {
      this.toast.show(this.language.translate('notifications.review'), 'info');
    }
  }
}
