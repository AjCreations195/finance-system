import { Component, ElementRef, inject, input, output, viewChild } from '@angular/core';
import { FinancialStat } from '../../../core/models/dashboard.models';
import { LanguageService } from '../../../core/services/language.service';
import { CountUpDirective } from '../../directives/count-up.directive';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { IconComponent } from '../icon/icon.component';

/**
 * StatCarouselComponent
 * ---------------------
 * Row of financial statistic cards with previous/next arrows (design).
 * Used by the Dashboard and the Purchase Requests page; each page passes
 * its own cards: <app-stat-carousel [stats]="stats()" />
 * With `selectable`, each card is a button that filters the page
 * (`(statSelect)`), and `activeId` highlights the current one.
 *
 * Responsive: the row scrolls sideways with CSS scroll-snap. Cards per
 * view: 1.2 on phones → 2 tablets → 3 laptops → 4 → 5 on wide screens.
 * The arrows scroll by one card, in the reading direction (RTL-aware).
 */
@Component({
  selector: 'app-stat-carousel',
  imports: [IconComponent, TranslatePipe, CountUpDirective],
  templateUrl: './stat-carousel.component.html',
  styleUrl: './stat-carousel.component.scss',
})
export class StatCarouselComponent {
  /** Cards to show. */
  readonly stats = input.required<FinancialStat[]>();
  /** Cards act as filters: clicking one emits its id (`statSelect`). */
  readonly selectable = input(false);
  /** Card shown as the current filter. */
  readonly activeId = input<string | null>(null);
  readonly statSelect = output<string>();

  private readonly language = inject(LanguageService);
  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');

  /** "50 million riyals" / "50 مليون ريال" */
  /** Arrow property, so the count-up directive can call it while it animates. */
  protected readonly formatAmount = (amount: number): string => {
    const compact = new Intl.NumberFormat(this.language.locale(), { notation: 'compact', compactDisplay: 'long' }).format(amount);
    return `${compact} ${this.language.translate('common.currency')}`;
  };

  /** Green when the change is good news, red when it's bad news. */
  protected isPositive(stat: FinancialStat): boolean {
    return stat.change >= 0 === stat.higherIsBetter;
  }

  /**
   * Scroll by one card. `direction` 1 = next (reading direction).
   * In RTL, scrolling forward means moving left, so the sign is flipped.
   */
  protected scroll(direction: 1 | -1): void {
    const el = this.track().nativeElement;
    const card = el.querySelector<HTMLElement>('.stat-card');
    const step = (card?.offsetWidth ?? 240) + 16;
    const sign = this.language.isRtl() ? -1 : 1;
    el.scrollBy({ left: step * direction * sign, behavior: 'smooth' });
  }
}
