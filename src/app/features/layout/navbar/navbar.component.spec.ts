import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../core/services/theme.service';
import { ToastService } from '../../../core/services/toast.service';
import { PurchaseRequestService } from '../../../core/services/purchase-request.service';
import { WorkspaceTabsService } from '../../../core/services/workspace-tabs.service';
import { NavbarComponent } from './navbar.component';

describe('NavbarComponent', () => {
  let fixture: ComponentFixture<NavbarComponent>;
  let el: HTMLElement;
  let auth: AuthService;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(
      'fs-user',
      JSON.stringify({ id: 1, name: { en: 'Test User', ar: 'Test User' }, email: 't@x.com', role: { en: 'Finance', ar: 'Finance' }, avatarUrl: 'avatar.svg' }),
    );

    await TestBed.configureTestingModule({ imports: [NavbarComponent], providers: [provideRouter([])] }).compileComponents();
    auth = TestBed.inject(AuthService);
    fixture = TestBed.createComponent(NavbarComponent);
    el = fixture.nativeElement;
    await fixture.whenStable();
  });

  const userButton = () => el.querySelector<HTMLButtonElement>('.user-btn')!;
  const menuOpen = () => el.querySelector('.user-menu [role="menu"]') !== null;

  it('shows the signed-in user name', () => {
    expect(userButton().textContent).toContain('Test User');
  });

  it('uses the light-text logo in the dark theme', async () => {
    const logo = () => el.querySelector<HTMLImageElement>('.brand-logo')!.getAttribute('src');
    const theme = TestBed.inject(ThemeService);

    theme.setTheme('light');
    await fixture.whenStable();
    expect(logo()).toBe('images/moi-logo.svg');

    theme.setTheme('dark');
    await fixture.whenStable();
    expect(logo()).toBe('images/moi-logo-dark.svg');
  });

  it('opens the user menu, and closes it on an outside click', async () => {
    userButton().click();
    await fixture.whenStable();
    expect(userButton().getAttribute('aria-expanded')).toBe('true');
    expect(menuOpen()).toBe(true);

    document.body.click();
    await fixture.whenStable();
    expect(userButton().getAttribute('aria-expanded')).toBe('false');
  });

  it('closes the user menu with Escape', async () => {
    userButton().click();
    await fixture.whenStable();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
    expect(userButton().getAttribute('aria-expanded')).toBe('false');
  });

  it('logout signs out and goes to /login', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    userButton().click();
    await fixture.whenStable();

    el.querySelector<HTMLButtonElement>('.user-menu .logout-item')!.click();

    expect(auth.isAuthenticated()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('the hamburger button asks the layout to open the sidebar', () => {
    const emitted = vi.fn();
    fixture.componentInstance.menuToggle.subscribe(emitted);
    el.querySelector<HTMLButtonElement>('.d-lg-none')!.click();
    expect(emitted).toHaveBeenCalled();
  });

  it('the user menu holds the language and theme controls (for phones), and stays open while they are used', async () => {
    userButton().click();
    await fixture.whenStable();
    const menu = el.querySelector('.user-menu [role="menu"]')!;
    expect(menu.querySelector('app-language-switcher')).not.toBeNull();

    menu.querySelector<HTMLButtonElement>('app-theme-toggle button')!.click();
    await fixture.whenStable();
    expect(menuOpen()).toBe(true);
  });

  describe('user menu focus', () => {
    const menu = () => el.querySelector<HTMLElement>('.user-menu [role="menu"]')!;
    const focusOut = (to: HTMLElement) => menu().dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: to }));

    beforeEach(async () => {
      userButton().click();
      await fixture.whenStable();
    });

    it('focuses the panel (not Logout) when it opens', () => {
      expect(document.activeElement).toBe(menu());
    });

    it('Escape closes it and gives focus back to the avatar button', async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await fixture.whenStable();
      expect(menuOpen()).toBe(false);
      expect(document.activeElement).toBe(userButton());
    });

    it('stays open while focus moves between its own controls', async () => {
      focusOut(el.querySelector<HTMLElement>('.user-menu .logout-item')!);
      await fixture.whenStable();
      expect(menuOpen()).toBe(true);
    });

    it('closes when focus leaves it', async () => {
      focusOut(el.querySelector<HTMLElement>('.brand')!);
      await fixture.whenStable();
      expect(menuOpen()).toBe(false);
    });
  });

  describe('global search', () => {
    const input = () => el.querySelector<HTMLInputElement>('.global-search input')!;
    const options = () => [...el.querySelectorAll<HTMLElement>('.search-results [role="option"]')];
    const type = async (text: string) => {
      input().dispatchEvent(new FocusEvent('focus'));
      input().value = text;
      input().dispatchEvent(new Event('input'));
      await fixture.whenStable();
    };
    const key = async (k: string) => {
      input().dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
      await fixture.whenStable();
    };

    it('opens suggestions as soon as the field is clicked into, before anything is typed', async () => {
      await type('');
      expect(el.querySelector('.search-results')).not.toBeNull();
      expect(input().getAttribute('aria-expanded')).toBe('true');
      expect(options().length).toBeGreaterThan(0);
    });

    it('finds sidebar pages by their label', async () => {
      await type('procure');
      expect(options()[0].textContent).toContain('Procurement');
    });

    it('opens a matching page with Enter', async () => {
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      await type('procure');
      await key('Enter');
      expect(navigate).toHaveBeenCalledWith('/procurement/purchase-requests');
      expect(input().value).toBe('');
    });

    it('finds purchase requests by number and opens one in its tab', async () => {
      const request = TestBed.inject(PurchaseRequestService).requests()[0];
      const openRequest = vi.spyOn(TestBed.inject(WorkspaceTabsService), 'openRequest').mockImplementation(() => {});
      await type(request.number);

      options()[0].click();
      expect(openRequest).toHaveBeenCalledWith(request.id);
    });

    it('arrow keys move the highlight, and "View all" shows a not-available toast', async () => {
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      const request = TestBed.inject(PurchaseRequestService).requests()[0];
      await type(request.number);
      expect(options()[0].getAttribute('aria-selected')).toBe('true');

      await key('ArrowUp'); // wraps to the last option: "View all"
      const last = options().at(-1)!;
      expect(last.classList).toContain('view-all');
      expect(input().getAttribute('aria-activedescendant')).toBe(last.id);

      await key('Enter');
      expect(navigate).not.toHaveBeenCalled();
      expect(TestBed.inject(ToastService).toasts().at(-1)?.type).toBe('info');
    });

    it('says so when nothing matches', async () => {
      await type('zzzz-no-match');
      expect(options().length).toBe(0);
      expect(el.querySelector('.results-empty')?.textContent).toContain('zzzz-no-match');
    });

    it('Escape clears the box', async () => {
      await type('procure');
      await key('Escape');
      expect(input().value).toBe('');
    });
  });

});
