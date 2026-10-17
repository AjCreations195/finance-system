import { Component, computed, input } from '@angular/core';

/**
 * IconComponent
 * -------------
 * Shows an icon from public/icons/<name>.svg (Figma exports, plus a few
 * Material Symbols for glyphs the design doesn't include).
 *
 * The SVG is used as a CSS mask filled with `currentColor`, so the icon takes
 * the text color around it, just like an icon font: hover
 * colors, dark mode and white-on-burgundy buttons all work without separate
 * files per color. Each SVG is downloaded only when a page uses it, then cached.
 * Size follows `font-size` (1em square), so it lines up with the text.
 *
 * Decorative by default (hidden from screen readers, as icons next to a text
 * label should be). Pass `label` when the icon is the only content, e.g.
 * an icon-only button without its own aria-label.
 *
 * @example <app-icon name="eye" />
 * @example <app-icon [name]="status.icon" />   <!-- e.g. "state-new" -->
 * @example <app-icon name="warning" label="Error" />
 *
 * Note: single-color icons only (the mask uses the shape, not the colors).
 * Logos and multi-color artwork stay as <img>.
 */
@Component({
  selector: 'app-icon',
  template: '',
  styles: `
    :host {
      display: inline-block;
      flex-shrink: 0;
      vertical-align: -0.125em;
      width: 1em;
      height: 1em;
      background-color: currentColor;
      -webkit-mask: var(--icon-url) center / contain no-repeat;
      mask: var(--icon-url) center / contain no-repeat;
    }
  `,
  host: {
    // Lets CSS target one icon by name, e.g. mirroring an arrow in English
    '[attr.data-icon]': 'name()',
    '[style.--icon-url]': 'url()',
    '[attr.role]': 'label() ? "img" : null',
    '[attr.aria-label]': 'label() || null',
    '[attr.aria-hidden]': 'label() ? null : "true"',
  },
})
export class IconComponent {
  /** File name in public/icons without ".svg". */
  readonly name = input.required<string>();
  /** Accessible name; leave empty for decorative icons. */
  readonly label = input('');

  protected readonly url = computed(() => `url("icons/${this.name()}.svg")`);
}
