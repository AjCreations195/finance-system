import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { AuthService } from './core/services/auth.service';

describe('app routes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), { provide: AuthService, useValue: { isAuthenticated: () => true } }],
    });
  });

  it('redirects the old /purchase-orders URL to the purchase requests page', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/purchase-orders');
    expect(router.url).toBe('/procurement/purchase-requests');
  });

  it('labels the purchase requests page with its title, not "new request"', () => {
    const page = routes.flatMap((r) => r.children ?? []).find((r) => r.path === 'procurement/purchase-requests');
    expect(page?.data?.['breadcrumb']).toEqual(['nav.procurement', 'requests.title']);
  });
});
