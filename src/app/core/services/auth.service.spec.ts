import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { User } from '../models/user.model';
import { AuthService, DEMO_CREDENTIALS } from './auth.service';

const SESSION_KEY = 'fs-user';
const ACCOUNTS_KEY = 'fs-accounts';
const LATENCY = 700;

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.useFakeTimers();
    service = TestBed.inject(AuthService);
  });

  afterEach(() => vi.useRealTimers());

  /** Subscribe, let the simulated network delay pass, and report what happened. */
  function run<T>(source: Observable<T>): { value?: T; error?: Error } {
    const result: { value?: T; error?: Error } = {};
    source.subscribe({ next: (v) => (result.value = v), error: (e: Error) => (result.error = e) });
    vi.advanceTimersByTime(LATENCY);
    return result;
  }

  it('starts signed out', () => {
    expect(service.user()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });

  describe('login', () => {
    it('accepts the demo account by email', () => {
      const { value } = run(service.login(DEMO_CREDENTIALS.email, DEMO_CREDENTIALS.password, true));
      expect(value?.email).toBe(DEMO_CREDENTIALS.email);
      expect(service.isAuthenticated()).toBe(true);
    });

    it('accepts the demo account by username, ignoring case and spaces', () => {
      const { value } = run(service.login('  ADMIN ', DEMO_CREDENTIALS.password, true));
      expect(value).toBeDefined();
    });

    it('rejects a wrong password with INVALID_CREDENTIALS', () => {
      const { value, error } = run(service.login(DEMO_CREDENTIALS.email, 'wrong-password', true));
      expect(value).toBeUndefined();
      expect(error?.message).toBe('INVALID_CREDENTIALS');
      expect(service.isAuthenticated()).toBe(false);
    });

    it('waits for the simulated latency before answering', () => {
      let done = false;
      service.login(DEMO_CREDENTIALS.email, DEMO_CREDENTIALS.password, true).subscribe(() => (done = true));
      vi.advanceTimersByTime(LATENCY - 1);
      expect(done).toBe(false);
      vi.advanceTimersByTime(1);
      expect(done).toBe(true);
    });

    it('"remember me" saves the session in localStorage', () => {
      run(service.login(DEMO_CREDENTIALS.email, DEMO_CREDENTIALS.password, true));
      expect(localStorage.getItem(SESSION_KEY)).not.toBeNull();
      expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
    });

    it('without "remember me" the session goes to sessionStorage', () => {
      run(service.login(DEMO_CREDENTIALS.email, DEMO_CREDENTIALS.password, false));
      expect(sessionStorage.getItem(SESSION_KEY)).not.toBeNull();
      expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    });
  });

  describe('register', () => {
    it('creates an account that can then sign in', () => {
      const created = run(service.register(' Sara ', 'Sara@Example.com', 'Secret123'));
      expect(created.error).toBeUndefined();

      const saved = JSON.parse(localStorage.getItem(ACCOUNTS_KEY)!);
      expect(saved[0]).toMatchObject({ name: 'Sara', email: 'sara@example.com' });

      const { value } = run(service.login('sara@example.com', 'Secret123', true));
      expect(value?.name).toEqual({ en: 'Sara', ar: 'Sara' });
      expect(value?.role.en).toBe('Employee');
    });

    it('does not sign the new user in', () => {
      run(service.register('Sara', 'sara@example.com', 'Secret123'));
      expect(service.isAuthenticated()).toBe(false);
    });

    it('rejects an email that is already registered', () => {
      run(service.register('Sara', 'sara@example.com', 'Secret123'));
      const { error } = run(service.register('Other', 'SARA@example.com', 'Secret456'));
      expect(error?.message).toBe('EMAIL_TAKEN');
    });

    it('rejects the demo email', () => {
      const { error } = run(service.register('Demo', DEMO_CREDENTIALS.email, 'Secret123'));
      expect(error?.message).toBe('EMAIL_TAKEN');
    });

    it('treats corrupt saved accounts as empty', () => {
      localStorage.setItem(ACCOUNTS_KEY, '{not json');
      const { error } = run(service.login('sara@example.com', 'Secret123', true));
      expect(error?.message).toBe('INVALID_CREDENTIALS');
    });
  });

  it('requestPasswordReset always succeeds (does not reveal whether the email exists)', () => {
    let completed = false;
    service.requestPasswordReset('nobody@example.com').subscribe({ complete: () => (completed = true) });
    vi.advanceTimersByTime(LATENCY);
    expect(completed).toBe(true);
  });

  it('logout clears the user and both storages', () => {
    run(service.login(DEMO_CREDENTIALS.email, DEMO_CREDENTIALS.password, true));
    sessionStorage.setItem(SESSION_KEY, 'x');

    service.logout();

    expect(service.user()).toBeNull();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  describe('session restore', () => {
    const user: User = {
      id: 1,
      name: { en: 'Test', ar: 'Test' },
      email: 't@example.com',
      role: { en: 'Role', ar: 'Role' },
      avatarUrl: 'avatar.svg',
    };

    /** A fresh service reads storage in its constructor, like a page reload. */
    function reload(): AuthService {
      TestBed.resetTestingModule();
      return TestBed.inject(AuthService);
    }

    it('restores a session saved in localStorage', () => {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      expect(reload().user()).toEqual(user);
    });

    it('restores a session saved in sessionStorage', () => {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
      expect(reload().isAuthenticated()).toBe(true);
    });

    it('ignores a session from an older version (name as a plain string)', () => {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ ...user, name: 'Old' }));
      expect(reload().user()).toBeNull();
    });

    it('ignores corrupt session data', () => {
      localStorage.setItem(SESSION_KEY, '{broken');
      expect(reload().user()).toBeNull();
    });
  });
});
