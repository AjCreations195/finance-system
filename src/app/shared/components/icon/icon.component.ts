import { Component, computed, input } from '@angular/core';

/**
 * IconComponent
 * -------------
 * Shows an icon exported from the Figma design (public/icons/<name>.svg).
 *
 * The SVG is used as a CSS mask filled with `currentColor`, so the icon takes
 * the text color around it, just like the Bootstrap icon font: hover
 * colors, dark mode and white-on-burgundy buttons all work without separate
 * files per color. Each SVG is downloaded only when a page uses it, then cached.
 * Size follows `font-size` (1em square), so it lines up with the text.
 *
 * Names starting with "bi-" render the Bootstrap icon instead, so data-driven
 * icons (status maps, filter options…) can move to Figma SVGs one at a time.
 *
 * Decorative by default (hidden from screen readers, as icons next to a text
 * label should be). Pass `label` when the icon is the only content, e.g.
 * an icon-only button without its own aria-label.
 *
 * @example <app-icon name="eye" />
 * @example <app-icon [name]="status.icon" />   <!-- "state-new" or "bi-truck" -->
 * @example <app-icon name="warning" label="Error" />
 *
 * Note: single-color icons only (the mask uses the shape, not the colors).
 * Logos and multi-color artwork stay as <img>.
 */
@Component({
  selector: 'app-icon',
  template: `
    @if (isBootstrap()) {
      <i class="bi {{ name() }}"></i>
    }
  `,
  styles: `
    :host {
      display: inline-block;
      flex-shrink: 0;
      vertical-align: -0.125em;
    }

    :host(.svg-icon) {
      width: 1em;
      height: 1em;
      background-color: currentColor;
      -webkit-mask: var(--icon-url) center / contain no-repeat;
      mask: var(--icon-url) center / contain no-repeat;
    }

    i {
      display: block;
      line-height: 1;
    }
  `,
  host: {
    '[class.svg-icon]': '!isBootstrap()',
    // Lets CSS target one icon by name, e.g. mirroring an arrow in English
    '[attr.data-icon]': 'name()',
    '[style.--icon-url]': 'url()',
    '[attr.role]': 'label() ? "img" : null',
    '[attr.aria-label]': 'label() || null',
    '[attr.aria-hidden]': 'label() ? null : "true"',
  },
})
export class IconComponent {
  /** File name in public/icons without ".svg", or a Bootstrap class ("bi-…"). */
  readonly name = input.required<string>();
  /** Accessible name; leave empty for decorative icons. */
  readonly label = input('');

  protected readonly isBootstrap = computed(() => this.name().startsWith('bi-'));
  protected readonly url = computed(() => (this.isBootstrap() ? null : `url("icons/${this.name()}.svg")`));
}
