import { Component, ElementRef, afterNextRender, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { LanguageService } from '../../../core/services/language.service';
import { ToastService } from '../../../core/services/toast.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { LanguageSwitcherComponent } from '../../../shared/components/language-switcher/language-switcher.component';
import { ThemeToggleComponent } from '../../../shared/components/theme-toggle/theme-toggle.component';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

/** Minimum password length, used by the validator and the error message. */
const PASSWORD_MIN_LENGTH = 8;

/** App version shown in the footer. */
const APP_VERSION = '1.0.0';

/** Simple, readable email pattern (Angular's Validators.email accepts "a@b"). */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Custom validator: the value must be EITHER a valid email
 * OR a username (3+ chars: letters, digits, dot, underscore, dash).
 * Returns { identifier: true } when neither matches.
 */
export const emailOrUsernameValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = String(control.value ?? '').trim();
  if (!value) return null; // "required" handles empty values

  const isEmail = EMAIL_PATTERN.test(value);
  const isUsername = /^[a-zA-Z0-9._-]{3,}$/.test(value);
  return isEmail || isUsername ? null : { identifier: true };
};

/** Minimum length of the full name on the registration form. */
const NAME_MIN_LENGTH = 3;

/**
 * Password strength validator (registration): must contain at least one
 * letter (Latin or Arabic) and at least one digit. Returns { weak: true } otherwise.
 */
export const strongPasswordValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = String(control.value ?? '');
  if (!value) return null;
  return /[A-Za-z؀-ۿ]/.test(value) && /\d/.test(value) ? null : { weak: true };
};

/**
 * Group validator (registration): `password` and `confirmPassword` must match.
 * The error is set on the group, so the template reads it from the form.
 */
export const passwordsMatchValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const password = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return password && confirm && password !== confirm ? { mismatch: true } : null;
};

/**
 * Only allow redirects to pages inside this app ("/dashboard"), never to
 * another site ("//evil.com", "https://…"). Prevents an open-redirect attack
 * through the ?returnUrl= parameter.
 */
function safeReturnUrl(url: string | null): string {
  return url && url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/login') ? url : '/dashboard';
}

/**
 * LoginComponent
 * --------------
 * Sign-in page built with Reactive Forms.
 *
 * Layout (Bootstrap grid), matching the Figma design:
 *  - lg and up: form column (col-lg-5) + hero image column (col-lg-7).
 *    The form comes first in the DOM, so it's on the RIGHT in Arabic (RTL)
 *    and on the LEFT in English (LTR), with no extra CSS.
 *  - below lg: the hero image is hidden and the form takes full width.
 *
 * Three views share the same card (same design styles):
 *  - 'login'    → username + password form
 *  - 'forgot'   → email form that requests a reset link, then a confirmation
 *  - 'register' → create-account form; the new account can sign in right away
 *
 * Behaviour:
 *  - Field errors appear after the field is touched or the form is submitted;
 *    on a failed submit the first invalid field gets focus.
 *  - The submit button shows a spinner and is disabled while the request runs.
 *  - Wrong credentials show an alert, cleared as soon as the user edits.
 *  - A Caps Lock warning appears while typing the password.
 *  - After login the user returns to the page they originally asked for.
 */
@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, TranslatePipe, ThemeToggleComponent, LanguageSwitcherComponent, IconComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly passwordMinLength = PASSWORD_MIN_LENGTH;
  protected readonly version = APP_VERSION;
  protected readonly year = new Date().getFullYear();

  // ---- UI state (signals, so the zoneless app re-renders on change) ----
  /** Which view the card shows. */
  protected readonly view = signal<'login' | 'forgot' | 'register'>('login');
  protected readonly loading = signal(false);
  protected readonly submitted = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly capsLock = signal(false);
  protected readonly loginError = signal<string | null>(null);

  // Forgot-password view state
  protected readonly resetSubmitted = signal(false);
  /** Email the reset link was "sent" to (null = form not sent yet). */
  protected readonly resetSentTo = signal<string | null>(null);

  // Registration view state
  protected readonly nameMinLength = NAME_MIN_LENGTH;
  protected readonly registerSubmitted = signal(false);
  /** Backend error on registration (e.g. email already used), as a translation key. */
  protected readonly registerError = signal<string | null>(null);

  // ---- Reactive form definitions ----
  // nonNullable: reset() restores the initial values instead of null.
  protected readonly loginForm = this.fb.nonNullable.group({
    identifier: ['', [Validators.required, emailOrUsernameValidator]],
    password: ['', [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH)]],
    remember: [true],
  });

  protected readonly forgotForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.pattern(EMAIL_PATTERN)]],
  });

  /** Registration form; the group validator checks that the passwords match. */
  protected readonly registerForm = this.fb.nonNullable.group(
    {
      name: ['', [Validators.required, Validators.minLength(NAME_MIN_LENGTH)]],
      email: ['', [Validators.required, Validators.pattern(EMAIL_PATTERN)]],
      password: ['', [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH), strongPasswordValidator]],
      confirmPassword: ['', [Validators.required]],
      acceptTerms: [false, [Validators.requiredTrue]],
    },
    { validators: passwordsMatchValidator },
  );

  /** Shortcut for template access: r.name, r.email … */
  protected get r() {
    return this.registerForm.controls;
  }

  /** Confirm field shows "mismatch" only once the user has touched it (or submitted). */
  protected showMismatch(): boolean {
    const confirm = this.r.confirmPassword;
    return this.registerForm.hasError('mismatch') && (confirm.touched || this.registerSubmitted());
  }

  /** Shortcut for template access to loginForm controls: f.identifier, f.password. */
  protected get f() {
    return this.loginForm.controls;
  }

  constructor() {
    // Hide the "wrong credentials" alert as soon as the user edits a field.
    this.loginForm.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.loginError()) this.loginError.set(null);
    });

    // Same for the "email already exists" error on the registration form.
    this.registerForm.controls.email.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.registerError()) this.registerError.set(null);
    });

    // Put the cursor in the first field once the page is rendered. Desktop only:
    // on phones it would pop up the keyboard and hide half the page.
    afterNextRender(() => {
      if (window.matchMedia('(min-width: 992px)').matches) this.focus('#identifier');
    });
  }

  /** Whether a control's error should be shown (touched or submitted). */
  protected showError(control: AbstractControl, submitted = this.submitted()): boolean {
    return control.invalid && (control.touched || submitted);
  }


  /** Track Caps Lock while the password field has focus. */
  protected onPasswordKey(event: KeyboardEvent): void {
    this.capsLock.set(event.getModifierState?.('CapsLock') ?? false);
  }

  // ------------------------------------------------------------------
  // Login
  // ------------------------------------------------------------------
  protected onSubmit(): void {
    this.submitted.set(true);
    this.loginError.set(null);

    // Show all errors and move focus to the first invalid field.
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.focus('form .ng-invalid[formControlName]');
      return;
    }

    const { identifier, password, remember } = this.loginForm.getRawValue();
    this.loading.set(true);

    this.auth
      .login(identifier, password, remember)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => void this.router.navigateByUrl(safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'))),
        error: () => {
          this.loginError.set('login.invalidCredentials');
          // Standard practice: clear the wrong password. emitEvent: false so this
          // doesn't count as "user edited" and instantly hide the alert again.
          this.f.password.reset('', { emitEvent: false });
          this.focus('#password');
        },
      });
  }

  // ------------------------------------------------------------------
  // Forgot password
  // ------------------------------------------------------------------
  protected openForgot(event: Event): void {
    event.preventDefault();
    // Pre-fill with the typed identifier when it already looks like an email.
    const typed = this.f.identifier.value.trim();
    this.forgotForm.reset({ email: EMAIL_PATTERN.test(typed) ? typed : '' });
    this.resetSubmitted.set(false);
    this.resetSentTo.set(null);
    this.view.set('forgot');
    this.focus('#reset-email');
  }

  protected backToLogin(): void {
    this.view.set('login');
    this.focus('#identifier');
  }

  protected onForgotSubmit(): void {
    this.resetSubmitted.set(true);
    if (this.forgotForm.invalid) {
      this.forgotForm.markAllAsTouched();
      this.focus('#reset-email');
      return;
    }

    const email = this.forgotForm.getRawValue().email.trim();
    this.loading.set(true);
    this.auth
      .requestPasswordReset(email)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe(() => this.resetSentTo.set(email));
  }

  // ------------------------------------------------------------------
  // Create account
  // ------------------------------------------------------------------
  protected openRegister(event: Event): void {
    event.preventDefault();
    this.registerForm.reset();
    this.registerSubmitted.set(false);
    this.registerError.set(null);
    this.showPassword.set(false);
    this.view.set('register');
    this.focus('#reg-name');
  }

  protected onRegisterSubmit(): void {
    this.registerSubmitted.set(true);
    this.registerError.set(null);

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      // The mismatch error lives on the group, so focus the confirm field for it.
      const firstInvalid = this.host.nativeElement.querySelector<HTMLElement>('form .ng-invalid[formControlName]');
      if (firstInvalid) firstInvalid.focus();
      else if (this.registerForm.hasError('mismatch')) this.focus('#reg-confirm');
      return;
    }

    const { name, email, password } = this.registerForm.getRawValue();
    this.loading.set(true);

    this.auth
      .register(name, email, password)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => {
          // Back to login with the new email filled in, ready for the password.
          this.toast.show(this.language.translate('login.accountCreated'), 'success');
          this.loginForm.reset({ identifier: email.trim().toLowerCase(), password: '', remember: true });
          this.submitted.set(false);
          this.view.set('login');
          this.focus('#password');
        },
        error: (err: Error) => {
          if (err.message === 'EMAIL_TAKEN') {
            this.registerError.set('login.errors.emailTaken');
            this.focus('#reg-email');
          }
        },
      });
  }

  /** Focus an element inside this component after the view updates. */
  private focus(selector: string): void {
    setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus());
  }
}
