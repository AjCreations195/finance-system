import { DOCUMENT, Injectable, computed, effect, inject, signal } from '@angular/core';

/** The two color modes the app supports. */
export type Theme = 'light' | 'dark';

/** localStorage key. Must match the pre-boot script in index.html. */
const STORAGE_KEY = 'fs-theme';

/**
 * ThemeService
 * ------------
 * Single source of truth for the Dark / Light color mode.
 *
 * How it works:
 *  - The current theme is held in a signal, so any component or computed
 *    value that reads it updates automatically when it changes.
 *  - An effect writes it to <html data-bs-theme="...">. Bootstrap 5.3
 *    reads that attribute to switch its own colors, and our CSS
 *    variables in styles.scss do the same.
 *  - The choice is saved to localStorage so it survives page reloads.
 *  - With no saved choice, the OS preference (prefers-color-scheme) is used.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  /** Private writable state. Components only get the read-only view below. */
  private readonly _theme = signal<Theme>(this.getInitialTheme());

  /** Current theme (read-only). */
  readonly theme = this._theme.asReadonly();

  /** Convenience flag for templates, e.g. choosing the sun or moon icon. */
  readonly isDark = computed(() => this._theme() === 'dark');

  constructor() {
    // Runs on startup and again whenever the theme changes.
    effect(() => {
      const theme = this._theme();
      this.document.documentElement.setAttribute('data-bs-theme', theme);
      this.safeStorage(() => localStorage.setItem(STORAGE_KEY, theme));
    });
  }

  /** Switch between light and dark. */
  toggle(): void {
    this._theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  /** Set a specific theme. */
  setTheme(theme: Theme): void {
    this._theme.set(theme);
  }

  /** Resolve the starting theme: saved choice → OS preference → light. */
  private getInitialTheme(): Theme {
    const saved = this.safeStorage(() => localStorage.getItem(STORAGE_KEY));
    if (saved === 'light' || saved === 'dark') return saved;

    const prefersDark = this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  }

  /** localStorage can throw (private mode, blocked cookies), so guard every call. */
  private safeStorage<T>(fn: () => T): T | null {
    try {
      return fn();
    } catch {
      return null;
    }
  }
}
