import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { NavbarComponent } from '../navbar/navbar.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { WorkspaceTabsComponent } from '../workspace-tabs/workspace-tabs.component';

const COLLAPSE_KEY = 'fs-sidebar-collapsed';

/**
 * MainLayoutComponent
 * -------------------
 * Shell for every signed-in page, matching the Figma layout:
 *
 *   ┌──────────────────────────────────────────────┐
 *   │ Navbar (fixed, full width)                    │
 *   ├──────────────────────────────┬───────────────┤
 *   │ Breadcrumb + tabs            │               │
 *   │ <router-outlet> page content │   Sidebar     │  ← RTL
 *   └──────────────────────────────┴───────────────┘
 *   (In English the sidebar is on the left; logical CSS handles it.)
 *
 * State:
 *  - sidebarCollapsed (desktop rail mode), remembered in localStorage
 *  - sidebarOpen (mobile slide-in), closed on navigation / backdrop / Esc
 */
@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, NavbarComponent, SidebarComponent, WorkspaceTabsComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
  host: {
    '[class.sidebar-collapsed]': 'sidebarCollapsed()',
    '(document:keydown.escape)': 'sidebarOpen.set(false)',
  },
})
export class MainLayoutComponent {
  private readonly router = inject(Router);

  protected readonly sidebarOpen = signal(false);
  protected readonly sidebarCollapsed = signal(readCollapsed());

  constructor() {
    // Close the mobile sidebar after each navigation.
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() => this.sidebarOpen.set(false));

    // Remember the desktop collapsed state.
    effect(() => {
      try {
        localStorage.setItem(COLLAPSE_KEY, String(this.sidebarCollapsed()));
      } catch {
        /* ignore */
      }
    });
  }

  protected toggleCollapsed(): void {
    this.sidebarCollapsed.update((c) => !c);
  }
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === 'true';
  } catch {
    return false;
  }
}
