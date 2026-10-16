import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService, DEMO_CREDENTIALS } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { LoginComponent, emailOrUsernameValidator, passwordsMatchValidator, strongPasswordValidator } from './login.component';

describe('Login validators', () => {
  const check = (value: unknown) => emailOrUsernameValidator(new FormControl(value));

  it('emailOrUsernameValidator accepts an email or a username', () => {
    expect(check('admin@demo.com')).toBeNull();
    expect(check('john.doe_1')).toBeNull();
    expect(check('')).toBeNull(); // left to Validators.required
  });

  it('emailOrUsernameValidator rejects short names, spaces and half-emails', () => {
    expect(check('ab')).toEqual({ identifier: true });
    expect(check('john doe')).toEqual({ identifier: true });
    expect(check('a@b')).toEqual({ identifier: true });
  });

  it('strongPasswordValidator needs a letter and a digit', () => {
    const check = (v: string) => strongPasswordValidator(new FormControl(v));
    expect(check('password1')).toBeNull();
    expect(check('كلمةسر1')).toBeNull(); // Arabic letters count too
    expect(check('password')).toEqual({ weak: true });
    expect(check('12345678')).toEqual({ weak: true });
    expect(check('')).toBeNull();
  });

  it('passwordsMatchValidator flags different passwords only when both are filled', () => {
    const group = (password: string, confirmPassword: string) =>
      passwordsMatchValidator(new FormGroup({ password: new FormControl(password), confirmPassword: new FormControl(confirmPassword) }));
    expect(group('Secret123', 'Secret123')).toBeNull();
    expect(group('Secret123', 'Other123')).toEqual({ mismatch: true });
    expect(group('Secret123', '')).toBeNull();
  });
});

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;
  let el: HTMLElement;
  let router: Router;
  let auth: { login: ReturnType<typeof vi.fn>; register: ReturnType<typeof vi.fn>; requestPasswordReset: ReturnType<typeof vi.fn> };

  async function setup(returnUrl: string | null = null): Promise<void> {
    localStorage.clear();
    auth = {
      login: vi.fn().mockReturnValue(of({})),
      register: vi.fn().mockReturnValue(of(undefined)),
      requestPasswordReset: vi.fn().mockReturnValue(of(undefined)),
    };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(returnUrl ? { returnUrl } : {}) } } },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    await fixture.whenStable();
  }

  function type(selector: string, value: string): void {
    const input = el.querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  async function submit(): Promise<void> {
    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  async function click(selector: string): Promise<void> {
    el.querySelector<HTMLElement>(selector)!.click();
    await fixture.whenStable();
  }

  describe('sign in', () => {
    beforeEach(() => setup());

    it('shows required errors and does not call the API when the form is empty', async () => {
      await submit();
      expect(el.querySelector('#identifier-error')).not.toBeNull();
      expect(el.querySelector('#password-error')).not.toBeNull();
      expect(auth.login).not.toHaveBeenCalled();
    });

    it('does not show an error when a field is just focused and left (nothing typed yet)', async () => {
      const input = el.querySelector<HTMLInputElement>('#identifier')!;
      input.dispatchEvent(new Event('focus'));
      input.dispatchEvent(new Event('blur'));
      await fixture.whenStable();
      expect(el.querySelector('#identifier-error')).toBeNull();
    });

    it('shows the error once the user typed, cleared the field and left it', async () => {
      type('#identifier', 'a');
      type('#identifier', '');
      el.querySelector<HTMLInputElement>('#identifier')!.dispatchEvent(new Event('blur'));
      await fixture.whenStable();
      expect(el.querySelector('#identifier-error')).not.toBeNull();
    });

    it('signs in with valid input and goes to the dashboard', async () => {
      type('#identifier', 'admin');
      type('#password', 'Admin@123');
      await submit();

      expect(auth.login).toHaveBeenCalledWith('admin', 'Admin@123', true);
      expect(router.navigateByUrl).toHaveBeenCalledWith('/dashboard');
    });


    it('on wrong credentials shows an alert and clears the password', async () => {
      auth.login.mockReturnValue(throwError(() => new Error('INVALID_CREDENTIALS')));
      type('#identifier', 'admin');
      type('#password', 'WrongPass1');
      await submit();

      expect(el.querySelector('[role="alert"]')).not.toBeNull();
      expect(el.querySelector<HTMLInputElement>('#password')!.value).toBe('');
      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });

    it('hides the error alert as soon as the user edits a field', async () => {
      auth.login.mockReturnValue(throwError(() => new Error('INVALID_CREDENTIALS')));
      type('#identifier', 'admin');
      type('#password', 'WrongPass1');
      await submit();

      type('#identifier', 'admin2');
      await fixture.whenStable();
      expect(el.querySelector('[role="alert"]')).toBeNull();
    });

    it('toggles password visibility', async () => {
      const input = el.querySelector<HTMLInputElement>('#password')!;
      expect(input.type).toBe('password');
      component['showPassword'].set(true);
      await fixture.whenStable();
      expect(input.type).toBe('text');
    });

    it('tracks Caps Lock from keyboard events', () => {
      component['onPasswordKey']({ getModifierState: () => true } as unknown as KeyboardEvent);
      expect(component['capsLock']()).toBe(true);
    });
  });

  describe('returnUrl', () => {
    it('goes back to the page the user asked for', async () => {
      await setup('/procurement/purchase-requests');
      component['loginForm'].patchValue({ identifier: DEMO_CREDENTIALS.email, password: DEMO_CREDENTIALS.password });
      await submit();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/procurement/purchase-requests');
    });

    it.each(['//evil.com', 'https://evil.com', '/login'])('ignores the unsafe returnUrl "%s"', async (url) => {
      await setup(url);
      component['loginForm'].patchValue({ identifier: DEMO_CREDENTIALS.email, password: DEMO_CREDENTIALS.password });
      await submit();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/dashboard');
    });
  });

  describe('forgot password', () => {
    beforeEach(() => setup());

    it('opens with the typed email pre-filled', async () => {
      type('#identifier', 'user@example.com');
      await click('a.link-muted');

      expect(component['view']()).toBe('forgot');
      expect(el.querySelector<HTMLInputElement>('#reset-email')!.value).toBe('user@example.com');
    });

    it('does not pre-fill a username', async () => {
      type('#identifier', 'admin');
      await click('a.link-muted');
      expect(el.querySelector<HTMLInputElement>('#reset-email')!.value).toBe('');
    });

    it('validates the email, then shows the confirmation', async () => {
      await click('a.link-muted');
      await submit();
      expect(el.querySelector('#reset-email-error')).not.toBeNull();
      expect(auth.requestPasswordReset).not.toHaveBeenCalled();

      type('#reset-email', 'user@example.com');
      await submit();
      expect(auth.requestPasswordReset).toHaveBeenCalledWith('user@example.com');
      expect(component['resetSentTo']()).toBe('user@example.com');
    });
  });

  describe('create account', () => {
    beforeEach(() => setup());

    async function openRegister(): Promise<void> {
      await click('a.link-brand');
      expect(component['view']()).toBe('register');
    }

    function fillRegister(confirm = 'Secret123'): void {
      type('#reg-name', 'Sara Ali');
      type('#reg-email', 'Sara@Example.com');
      type('#reg-password', 'Secret123');
      type('#reg-confirm', confirm);
      const terms = el.querySelector<HTMLInputElement>('#reg-terms')!;
      terms.checked = true;
      terms.dispatchEvent(new Event('change'));
    }

    it('shows errors for an empty form', async () => {
      await openRegister();
      await submit();
      expect(el.querySelector('#reg-name-error')).not.toBeNull();
      expect(el.querySelector('#reg-terms-error')).not.toBeNull();
      expect(auth.register).not.toHaveBeenCalled();
    });

    it('shows a mismatch error when the passwords differ', async () => {
      await openRegister();
      fillRegister('Different1');
      await submit();
      expect(el.querySelector('#reg-confirm-error')?.textContent).toContain('match');
      expect(auth.register).not.toHaveBeenCalled();
    });

    it('registers, shows a toast and returns to sign-in with the email filled in', async () => {
      const toast = TestBed.inject(ToastService);
      await openRegister();
      fillRegister();
      await submit();

      expect(auth.register).toHaveBeenCalledWith('Sara Ali', 'Sara@Example.com', 'Secret123');
      expect(toast.toasts().length).toBe(1);
      expect(component['view']()).toBe('login');
      expect(el.querySelector<HTMLInputElement>('#identifier')!.value).toBe('sara@example.com');
    });

    it('shows an error when the email is already taken', async () => {
      auth.register.mockReturnValue(throwError(() => new Error('EMAIL_TAKEN')));
      await openRegister();
      fillRegister();
      await submit();

      expect(component['registerError']()).toBe('login.errors.emailTaken');
      expect(component['view']()).toBe('register');
    });
  });
});
