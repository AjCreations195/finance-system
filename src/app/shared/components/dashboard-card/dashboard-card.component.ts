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
    <!-- The card: "expanded" adds the full-screen styling; aria-labelledby names the section after its title -->
    <section class="dash-card" [class.expanded]="expanded()" [attr.aria-labelledby]="headingId">
      <header class="dash-card-header">
        <div class="title-group">
          <span class="title-icon">
            <app-icon [name]="icon()" />
          </span>
          <h2 class="dash-card-title" [id]="headingId">{{ title() | translate }}</h2>
          <span class="title-sep" aria-hidden="true"></span>
          <!-- ⤢ button: toggles full-screen; aria-pressed tells screen readers its state -->
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
        <!-- Toolbar slot: the parent puts controls here with the card-actions attribute -->
        <div class="card-actions">
          <ng-content select="[card-actions]" />
        </div>
      </header>
      <!-- Body slot: any other content the parent places inside the card -->
      <div class="dash-card-body">
        <ng-content />
      </div>
    </section>
    <!-- Dark layer behind a full-screen card; clicking it closes the card -->
    @if (expanded()) {
      <div class="expand-backdrop" (click)="expanded.set(false)" aria-hidden="true"></div>
    }
  `,
  styleUrl: './dashboard-card.component.scss',
  // Esc anywhere on the page leaves full-screen mode.
  host: { '(document:keydown.escape)': 'expanded.set(false)' },
})
export class DashboardCardComponent {
  /** Translation key of the title. */
  readonly title = input.required<string>();
  /** Icon in the small square: an SVG name in public/icons. */
  readonly icon = input('grid');

  /** Whether the card currently fills the screen. */
  protected readonly expanded = signal(false);
  /** Unique id of the title, so the section can be labelled by it (aria-labelledby). */
  protected readonly headingId = `card-title-${nextId++}`;

  constructor() {
    // Lock page scroll while a card is in full-screen mode.
    const body = inject(DOCUMENT).body;
    effect(() => body.classList.toggle('overflow-hidden', this.expanded()));
  }
}

/** Counter that gives each card instance its own heading id. */
let nextId = 0;
