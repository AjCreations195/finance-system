import { Component, DOCUMENT, effect, inject, input, signal } from '@angular/core';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { IconComponent } from '../icon/icon.component';

/**
 * DashboardCardComponent
 * ----------------------
 * Shared frame for every dashboard widget, matching the design:
 *
 *   [icon] Title | ⤢ ················ [toolbar slot: filter / search …]
 *   ─────────────────────────────────────────────────────────────────
 *   [body slot]
 *
 * The ⤢ button expands the card to full screen (Esc or the button again
 * restores it), which helps with wide tables on small laptops.
 *
 * Usage:
 *   <app-dashboard-card title="tasks.title" icon="briefcase">
 *     <div card-actions>…toolbar…</div>
 *     …body…
 *   </app-dashboard-card>
 */
@Component({
  selector: 'app-dashboard-card',
  imports: [IconComponent, TranslatePipe],
  template: `
    <section class="dash-card" [class.expanded]="expanded()" [attr.aria-labelledby]="headingId">
      <header class="dash-card-header">
        <div class="title-group">
          <span class="title-icon">
            <app-icon [name]="icon()" />
          </span>
          <h2 class="dash-card-title" [id]="headingId">{{ title() | translate }}</h2>
          <span class="title-sep" aria-hidden="true"></span>
          <button
            type="button"
            class="expand-btn"
            (click)="expanded.set(!expanded())"
            [attr.aria-label]="(expanded() ? 'common.collapse' : 'common.expand') | translate"
            [attr.aria-pressed]="expanded()"
          >
            <app-icon [name]="expanded() ? 'collapse' : 'expand'" />
          </button>
        </div>
        <div class="card-actions">
          <ng-content select="[card-actions]" />
        </div>
      </header>
      <div class="dash-card-body">
        <ng-content />
      </div>
    </section>
    @if (expanded()) {
      <div class="expand-backdrop" (click)="expanded.set(false)" aria-hidden="true"></div>
    }
  `,
  styleUrl: './dashboard-card.component.scss',
  host: { '(document:keydown.escape)': 'expanded.set(false)' },
})
export class DashboardCardComponent {
  /** Translation key of the title. */
  readonly title = input.required<string>();
  /** Icon in the small square: an SVG name in public/icons. */
  readonly icon = input('grid');

  protected readonly expanded = signal(false);
  protected readonly headingId = `card-title-${nextId++}`;

  constructor() {
    // Lock page scroll while a card is in full-screen mode.
    const body = inject(DOCUMENT).body;
    effect(() => body.classList.toggle('overflow-hidden', this.expanded()));
  }
}

let nextId = 0;
