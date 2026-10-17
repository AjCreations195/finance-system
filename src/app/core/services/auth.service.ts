import { Injectable, computed, signal } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';
import { User } from '../models/user.model';

/** Demo credentials (listed in the README). Sign in with either the email or the username. */
export const DEMO_CREDENTIALS = { email: 'admin@demo.com', username: 'admin', password: 'Admin@123' } as const;

/** Error codes returned by the mock backend (translated in the UI). */
export type AuthError = 'INVALID_CREDENTIALS' | 'EMAIL_TAKEN';

/** Account created through the "Create account" form (mock storage). */
interface RegisteredAccount {
  id: number;
  name: string;
  email: string;
  password: string;
}

const SESSION_KEY = 'fs-user';
const ACCOUNTS_KEY = 'fs-accounts';

/** Simulated network delay (ms), so loading states are visible. */
const LATENCY = 600;

/**
 * AuthService
 * -----------
 * Mock authentication, kept apart from the UI so real API calls
 * (e.g. HttpClient.post('/api/login')) can replace it later without
 * changing any component.
 *
 * - login() accepts the demo account or any account created with register().
 * - register() saves new accounts in localStorage so they survive reloads.
 *   ⚠ Demo only: a real app NEVER stores passwords in the browser; the
 *   backend stores a salted hash and the client only sends the password once.
 * - "Remember me" stores the session in localStorage; otherwise in
 *   sessionStorage, which is cleared when the tab closes.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _user = signal<User | null>(this.restoreSession());

  /** Signed-in user, or null. */
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);

  /**
   * Sign in with an email/username and password.
   * Errors with 'INVALID_CREDENTIALS' when nothing matches.
   */
  login(identifier: string, password: string, remember: boolean): Observable<User> {
    const id = identifier.trim().toLowerCase();

    // 1) Demo account
    if ((id === DEMO_CREDENTIALS.email || id === DEMO_CREDENTIALS.username) && password === DEMO_CREDENTIALS.password) {
      return this.signIn(
        {
          id: 1,
          name: { en: 'Mohammed Abdullah', ar: 'محمد عبد الله' },
          email: DEMO_CREDENTIALS.email,
          role: { en: 'Finance Department', ar: 'قسم المالية' },
          avatarUrl: 'avatar.svg',
        },
        remember,
      );
    }

    // 2) Accounts created with the registration form
    const account = this.readAccounts().find((a) => a.email === id && a.password === password);
    if (account) {
      return this.signIn(
        {
          id: account.id,
          name: { en: account.name, ar: account.name },
          email: account.email,
          role: { en: 'Employee', ar: 'موظف' },
          avatarUrl: 'avatar.svg',
        },
        remember,
      );
    }

    // Delay the error too, so failure and success take the same time.
    return this.fail('INVALID_CREDENTIALS');
  }

  /**
   * Create a new account (mock). Errors with 'EMAIL_TAKEN' if the email is
   * already registered. Doesn't sign the user in; they log in afterwards.
   */
  register(name: string, email: string, password: string): Observable<void> {
    const normalized = email.trim().toLowerCase();
    const accounts = this.readAccounts();

    if (normalized === DEMO_CREDENTIALS.email || accounts.some((a) => a.email === normalized)) {
      return this.fail('EMAIL_TAKEN');
    }

    accounts.push({ id: Date.now(), name: name.trim(), email: normalized, password });
    try {
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    } catch {
      /* storage unavailable: the account only lives until reload */
    }
    return of(undefined).pipe(delay(LATENCY));
  }

  /**
   * Request a password-reset email (mock).
   * Always succeeds and never reveals whether the account exists, which
   * is the secure behaviour: it stops attackers from finding valid emails.
   */
  requestPasswordReset(email: string): Observable<void> {
    void email; // a real implementation would POST it to the API
    return of(undefined).pipe(delay(LATENCY));
  }

  /** Clear the session everywhere. */
  logout(): void {
    this._user.set(null);
    try {
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  /** Stores the signed-in user (localStorage when "remember me" is on, otherwise sessionStorage) and resolves after the simulated delay. */
  private signIn(user: User, remember: boolean): Observable<User> {
    this._user.set(user);
    try {
      (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(user));
    } catch {
      /* ignore */
    }
    return of(user).pipe(delay(LATENCY));
  }

  /** Returns an error after the same delay as a success, so the two can't be told apart by timing. */
  private fail<T>(code: AuthError): Observable<T> {
    return throwError(() => new Error(code)).pipe(delay(LATENCY));
  }

  /** Reads the accounts saved by register(); returns an empty list if storage is missing or corrupt. */
  private readAccounts(): RegisteredAccount[] {
    try {
      return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? '[]') as RegisteredAccount[];
    } catch {
      return [];
    }
  }

  /** Restore a previous session so a page reload doesn't log the user out. */
  private restoreSession(): User | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY);
      const user = raw ? (JSON.parse(raw) as User) : null;
      // Ignore sessions saved by an older version (name was a plain string).
      return user && typeof user.name === 'object' ? user : null;
    } catch {
      return null;
    }
  }
}
