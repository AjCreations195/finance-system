import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
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

    el.querySelector<HTMLButtonElement>('.user-menu .text-danger')!.click();

    expect(auth.isAuthenticated()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('the hamburger button asks the layout to open the sidebar', () => {
    const emitted = vi.fn();
    fixture.componentInstance.menuToggle.subscribe(emitted);
    el.querySelector<HTMLButtonElement>('.d-lg-none')!.click();
    expect(emitted).toHaveBeenCalled();
  });

  it('modules outside the demo show an info toast', () => {
    el.querySelector<HTMLButtonElement>('button[aria-label="Calendar"]')!.click();
    expect(TestBed.inject(ToastService).toasts().at(-1)?.type).toBe('info');
  });
});
