import { Injectable } from '@angular/core';

const STORAGE_KEY = 'fs-page-state';

/**
 * PageStateService
 * ----------------
 * Somewhere for a page to park its UI state (filters, sort, page number,
 * scroll position…) while its workspace tab is in the background, so
 * switching back restores it. Kept for the browser session, so a refresh
 * doesn't lose it either.
 *
 * @example
 *   const saved = pageState.restore<ListState>('procurement');
 *   effect(() => pageState.save('procurement', { search: this.search() }));
 */
@Injectable({ providedIn: 'root' })
export class PageStateService {
  /** In-memory copy of the saved states, loaded from sessionStorage once at startup. */
  private readonly store = new Map<string, unknown>(read());

  /** Saves a page's state under `key` and writes the whole store to sessionStorage. */
  save(key: string, state: unknown): void {
    this.store.set(key, state);
    this.persist();
  }

  /** Returns the state saved under `key`, or undefined if the page never saved one. */
  restore<T>(key: string): T | undefined {
    return this.store.get(key) as T | undefined;
  }

  /** Forget everything stored for a page (its tab was closed: it starts fresh next time). */
  clear(...keys: string[]): void {
    keys.forEach((k) => this.store.delete(k));
    this.persist();
  }

  /** Writes the store to sessionStorage as a list of [key, state] pairs. */
  private persist(): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...this.store]));
    } catch {
      /* storage full or blocked: state just lasts until the page reloads */
    }
  }
}

/** Reads the saved [key, state] pairs; returns an empty list if storage is missing or corrupt. */
function read(): [string, unknown][] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
