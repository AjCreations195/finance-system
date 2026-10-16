import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../core/services/theme.service';
import { ToastService } from '../../../core/services/toast.service';
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
      focusOut(el.querySelector<HTMLElement>('button[aria-label="Messages"]')!);
      await fixture.whenStable();
      expect(menuOpen()).toBe(false);
    });
  });

  it('modules outside the demo show an info toast', () => {
    el.querySelector<HTMLButtonElement>('button[aria-label="Messages"]')!.click();
    expect(TestBed.inject(ToastService).toasts().at(-1)?.type).toBe('info');
  });
});
