import { Component, computed, inject, signal } from '@angular/core';
import { ActivityItem, ActivityKind } from '../../../../core/models/dashboard.models';
import { DashboardDataService } from '../../../../core/services/dashboard-data.service';
import { LanguageService } from '../../../../core/services/language.service';
import { DashboardCardComponent } from '../../../../shared/components/dashboard-card/dashboard-card.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { LocalizePipe } from '../../../../shared/pipes/localize.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

type Period = 'today' | 'week' | 'month';

/** Days covered by each period button. */
const PERIOD_DAYS: Record<Period, number> = { today: 1, week: 7, month: 31 };

/**
 * Timeline dot color per activity type (colors from the design). Every dot
 * shows the same white speech bubble (chat.svg); a reply has no dot of its own,
 * it sits under the message it answers and ends with a ↶ chip (return.svg).
 */
const KIND_STYLE: Record<ActivityKind, { color: string }> = {
  message: { color: '#e48d21' },
  reply: { color: '#e48d21' },
  accepted: { color: '#9561e3' },
  answered: { color: '#37a7da' },
};

const COLLAPSED_COUNT = 5;

interface ActivityGroup {
  label: string;
  items: ActivityItem[];
}

/**
 * RecentActivitiesComponent ("الأنشطة الأخيرة")
 * ------------------------------------------
 * Vertical timeline grouped by day (Today / Yesterday / date), with a
 * Today–Week–Month segmented filter and a "Show all" expander.
 */
@Component({
  selector: 'app-recent-activities',
  imports: [DashboardCardComponent, IconComponent, TranslatePipe, LocalizePipe],
  templateUrl: './recent-activities.component.html',
  styleUrl: './recent-activities.component.scss',
})
export class RecentActivitiesComponent {
  private readonly data = inject(DashboardDataService);
  private readonly language = inject(LanguageService);

  protected readonly periods: Period[] = ['today', 'week', 'month'];
  protected readonly period = signal<Period>('month');
  protected readonly showAll = signal(false);
  protected readonly kindStyle = KIND_STYLE;

  /** Activities inside the selected period, newest first. */
  private readonly inPeriod = computed(() => {
    const since = startOfDay(new Date());
    since.setDate(since.getDate() - (PERIOD_DAYS[this.period()] - 1));
    const list = this.data
      .activities()
      .filter((a) => new Date(a.date) >= since)
      .sort((a, b) => b.date.localeCompare(a.date));
    return threadReplies(list);
  });

  protected readonly hasMore = computed(() => this.inPeriod().length > COLLAPSED_COUNT);

  /** Visible items grouped under day headings. */
  protected readonly groups = computed<ActivityGroup[]>(() => {
    const items = this.showAll() ? this.inPeriod() : this.inPeriod().slice(0, COLLAPSED_COUNT);
    const groups: ActivityGroup[] = [];
    for (const item of items) {
      const label = this.dayLabel(new Date(item.date));
      const last = groups.at(-1);
      if (last?.label === label) last.items.push(item);
      else groups.push({ label, items: [item] });
    }
    return groups;
  });

  /** "1 minute ago" for the last hour, otherwise the clock time ("12:30 PM"). */
  protected timeLabel(iso: string): string {
    const date = new Date(iso);
    const locale = this.language.locale();
    const minutes = Math.round((Date.now() - date.getTime()) / 60_000);
    if (minutes < 60) {
      return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-Math.max(minutes, 1), 'minute');
    }
    return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date);
  }

  /** Group heading: Today / Yesterday / "26 May 2026". */
  private dayLabel(date: Date): string {
    const today = startOfDay(new Date());
    const diffDays = Math.round((today.getTime() - startOfDay(date).getTime()) / 86_400_000);
    if (diffDays === 0) return this.language.translate('common.today');
    if (diffDays === 1) return this.language.translate('activities.yesterday');
    return new Intl.DateTimeFormat(this.language.locale(), { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  }
}

/**
 * Newest first, but a reply is placed right under the message it answers (as in
 * the design), even though the reply itself is newer.
 */
function threadReplies(sorted: ActivityItem[]): ActivityItem[] {
  const ids = new Set(sorted.map((a) => a.id));
  const isThreaded = (a: ActivityItem) => a.replyTo !== undefined && ids.has(a.replyTo);
  const result: ActivityItem[] = [];
  for (const item of sorted) {
    if (isThreaded(item)) continue;
    result.push(item, ...sorted.filter((r) => r.replyTo === item.id));
  }
  return result;
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}
