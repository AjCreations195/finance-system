import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { authGuard, guestGuard } from './auth.guard';

describe('auth guards', () => {
  const isAuthenticated = signal(false);
  let router: Router;

  beforeEach(() => {
    isAuthenticated.set(false);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: { isAuthenticated } }],
    });
    router = TestBed.inject(Router);
  });

  function runAuthGuard(url: string) {
    return TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    );
  }

  function runGuestGuard() {
    return TestBed.runInInjectionContext(() => guestGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
  }

  describe('authGuard', () => {
    it('lets a signed-in user through', () => {
      isAuthenticated.set(true);
      expect(runAuthGuard('/dashboard')).toBe(true);
    });

    it('sends a signed-out user to /login with the requested page as returnUrl', () => {
      const result = runAuthGuard('/procurement/purchase-requests?page=2');
      expect(result).toBeInstanceOf(UrlTree);
      expect(router.serializeUrl(result as UrlTree)).toBe('/login?returnUrl=%2Fprocurement%2Fpurchase-requests%3Fpage%3D2');
    });
  });

  describe('guestGuard', () => {
    it('lets a signed-out user open the login page', () => {
      expect(runGuestGuard()).toBe(true);
    });

    it('sends a signed-in user to the dashboard', () => {
      isAuthenticated.set(true);
      const result = runGuestGuard();
      expect(router.serializeUrl(result as UrlTree)).toBe('/dashboard');
    });
  });
});
