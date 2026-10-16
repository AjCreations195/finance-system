import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

/**
 * Application routes. Each page is lazy-loaded (loadComponent), so its
 * code is downloaded only when the user first visits it.
 */
export const routes: Routes = [
  // Public: login (signed-in users are redirected to the dashboard)
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },

  // Protected: everything inside the layout shell (sidebar + navbar)
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/layout/main-layout/main-layout.component').then((m) => m.MainLayoutComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        // breadcrumb: translation keys shown after "Home" (see WorkspaceTabsComponent)
        data: { breadcrumb: ['layout.tabs.dashboard'] },
        loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'procurement/purchase-requests',
        // The page lists purchase requests, so the last crumb matches its title ("Purchase request").
        data: { breadcrumb: ['nav.procurement', 'requests.title'] },
        loadComponent: () =>
          import('./features/purchase-orders/purchase-orders.component').then((m) => m.PurchaseOrdersComponent),
      },
      // Old URL, kept so existing links and bookmarks still work
      { path: 'purchase-orders', redirectTo: 'procurement/purchase-requests' },
    ],
  },

  // Unknown URLs
  { path: '**', redirectTo: '' },
];
