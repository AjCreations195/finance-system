import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { LanguageService } from '../../../core/services/language.service';
import { ToastService } from '../../../core/services/toast.service';
import { LocalizePipe } from '../../../shared/pipes/localize.pipe';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { NAV_FOOTER, NAV_TREE, NAV_TREE_SECONDARY, NavNode } from './nav-items';
import { IconComponent } from '../../../shared/components/icon/icon.component';

/**
 * SidebarComponent
 * ----------------
 * Navigation panel from the design: user block, menu search (Ctrl/⌘ + K),
 * a collapsible multi-level menu tree, and support/settings at the bottom.
 *
 * Two independent states, both controlled by the parent layout:
 *  - `collapsed` (desktop): narrow icon-only rail, toggled by the burgundy tab
 *  - `open` (mobile / tablet): slides in over the content
 *
 * The tree is rendered with a recursive <ng-template>, so any depth
 * of nesting works without extra components.
 */
@Component({
  selector: 'app-sidebar',
  imports: [IconComponent, NgTemplateOutlet, RouterLink, RouterLinkActive, TranslatePipe, LocalizePipe],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
  host: {
    '[class.collapsed]': 'collapsed()',
    '[class.open]': 'open()',
    '(document:keydown)': 'onKeydown($event)',
  },
})
export class SidebarComponent {
  protected readonly auth = inject(AuthService);
  private readonly language = inject(LanguageService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  /** Desktop icon-only mode. */
  readonly collapsed = input(false);
  /** Mobile slide-in visible. */
  readonly open = input(false);
  readonly toggleCollapse = output<void>();

  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  // ---- Menu data ----
  protected readonly footerItems = NAV_FOOTER;

  /** Text typed into the menu search box. */
  protected readonly query = signal('');

  /** Apple devices use the Command key (⌘); everyone else uses Ctrl. */
  protected readonly isApple = /Mac|iPhone|iPad/i.test(navigator.platform);

  /** Labels of expanded groups. Everything starts closed: only the main menus show. */
  private readonly expanded = signal(new Set<string>());

  /** Current URL, used to auto-expand the group that contains the active page. */
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** Primary + secondary trees after applying the search filter. */
  protected readonly primary = computed(() => this.filterTree(NAV_TREE));
  protected readonly secondary = computed(() => this.filterTree(NAV_TREE_SECONDARY));
  protected readonly noMatches = computed(() => !this.primary().length && !this.secondary().length);

  constructor() {
    // Open the groups leading to the current page after each navigation.
    // They're added to `expanded`, so the user can still close them.
    effect(() => {
      const url = this.url();
      const groups = [...NAV_TREE, ...NAV_TREE_SECONDARY].filter((node) => this.containsRoute(node, url));
      if (groups.length) this.expanded.update((set) => new Set([...set, ...this.openPath(groups, url)]));
    });
  }

  /** A group is open if the user expanded it or a search is active. */
  protected isExpanded(node: NavNode): boolean {
    return this.query() !== '' || this.expanded().has(node.label);
  }

  protected toggleGroup(node: NavNode): void {
    // In the narrow rail, clicking a group expands the whole sidebar with that group open.
    if (this.collapsed()) {
      this.toggleCollapse.emit();
      this.expanded.update((set) => new Set(set).add(node.label));
      return;
    }
    this.expanded.update((set) => {
      const next = new Set(set);
      if (next.has(node.label)) next.delete(node.label);
      else next.add(node.label);
      return next;
    });
  }

  /** Leaf without a route = module outside this task. */
  protected notAvailable(node: NavNode): void {
    if (node.disabled) return;
    this.toast.show(this.language.translate('login.featureNotAvailable'), 'info');
  }

  /** Ctrl / ⌘ + K focuses the menu search, as hinted in the design. */
  protected onKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (this.collapsed()) this.toggleCollapse.emit();
      setTimeout(() => this.searchInput()?.nativeElement.focus());
    }
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  /** Keep nodes whose label matches the query, or that have matching children. */
  private filterTree(nodes: NavNode[]): NavNode[] {
    const q = this.query().trim().toLowerCase();
    if (!q) return nodes;

    return nodes.flatMap((node) => {
      const selfMatch = this.language.translate(node.label).toLowerCase().includes(q);
      if (selfMatch) return [node];
      const children = node.children ? this.filterTree(node.children) : [];
      return children.length ? [{ ...node, children }] : [];
    });
  }

  private containsRoute(node: NavNode, url: string): boolean {
    return !!node.children?.some((c) => (c.route && url.startsWith(c.route)) || this.containsRoute(c, url));
  }

  /** Labels of the given groups and their nested groups that lead to `url`. */
  private openPath(groups: NavNode[], url: string): string[] {
    return groups.flatMap((g) => [g.label, ...this.openPath((g.children ?? []).filter((c) => this.containsRoute(c, url)), url)]);
  }
}
