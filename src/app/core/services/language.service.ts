import { DOCUMENT, Injectable, computed, effect, inject, signal } from '@angular/core';
import { AR } from '../i18n/ar';
import { EN, TranslationDictionary } from '../i18n/en';

/** Supported language codes. */
export type LanguageCode = 'en' | 'ar';

/** Text direction. */
export type Direction = 'ltr' | 'rtl';

/** Metadata for each supported language. */
export interface LanguageOption {
  code: LanguageCode;
  /** Name shown in the language switcher, written in that language. */
  label: string;
  dir: Direction;
  /**
   * BCP-47 locale for Intl date / number formatting (see format.pipes.ts).
   * 'ar-u-nu-latn' = Arabic month names + Western digits (0-9), as in most
   * Gulf business software. Use plain 'ar' for Arabic-Indic digits (٠-٩).
   */
  locale: string;
}

/**
 * Language registry. To add a language: add an entry here and add its
 * dictionary to DICTIONARIES.
 * The text direction comes from this entry, not from the components.
 */
export const LANGUAGES: readonly LanguageOption[] = [
  { code: 'en', label: 'English', dir: 'ltr', locale: 'en-US' },
  { code: 'ar', label: 'العربية', dir: 'rtl', locale: 'ar-u-nu-latn' },
];

const DICTIONARIES: Record<LanguageCode, TranslationDictionary> = { en: EN, ar: AR };

/** localStorage key. Must match the pre-boot script in index.html. */
const STORAGE_KEY = 'fs-lang';

/** Paths to the two Bootstrap builds (copied as assets in angular.json). */
const BOOTSTRAP_CSS: Record<Direction, string> = {
  ltr: 'assets/bootstrap/bootstrap.min.css',
  rtl: 'assets/bootstrap/bootstrap.rtl.min.css',
};

/**
 * LanguageService
 * ---------------
 * Handles the active language, translations and RTL / LTR layout direction.
 *
 * When the language changes, an effect:
 *  1. sets <html lang> and <html dir>, which mirrors native layout
 *     (flex order, text alignment, logical CSS properties);
 *  2. swaps the Bootstrap stylesheet for its RTL build, so utilities
 *     like `ms-*`, `me-*`, `text-start`, `float-end` flip correctly;
 *  3. saves the choice to localStorage.
 *
 * Direction is never chosen by hand: Arabic → RTL, English → LTR,
 * taken from the LANGUAGES registry.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly document = inject(DOCUMENT);

  /** All languages, for building the switcher UI. */
  readonly languages = LANGUAGES;

  private readonly _lang = signal<LanguageCode>(this.getInitialLanguage());

  /** Active language code. */
  readonly lang = this._lang.asReadonly();

  /** Full metadata of the active language. */
  readonly current = computed(() => LANGUAGES.find((l) => l.code === this._lang())!);

  /** Active direction ('ltr' | 'rtl'). Derived, so it can't get out of sync. */
  readonly dir = computed<Direction>(() => this.current().dir);
  readonly isRtl = computed(() => this.dir() === 'rtl');

  /** Locale for Intl formatting (used by the localDate / money pipes). */
  readonly locale = computed(() => this.current().locale);

  /** Active dictionary. */
  private readonly dictionary = computed(() => DICTIONARIES[this._lang()]);

  constructor() {
    // Apply the language to the document whenever it changes.
    effect(() => {
      const { code, dir } = this.current();
      const html = this.document.documentElement;

      html.setAttribute('lang', code);
      html.setAttribute('dir', dir);

      // Swap Bootstrap between its LTR and RTL builds.
      const link = this.document.getElementById('bootstrap-css') as HTMLLinkElement | null;
      if (link && !link.href.endsWith(BOOTSTRAP_CSS[dir])) {
        link.href = BOOTSTRAP_CSS[dir];
      }

      try {
        localStorage.setItem(STORAGE_KEY, code);
      } catch {
        /* storage unavailable: still works, just not saved */
      }
    });
  }

  /** Change the active language. */
  setLanguage(code: LanguageCode): void {
    this._lang.set(code);
  }

  /** Switch between the two languages (used by the compact navbar button). */
  toggle(): void {
    this._lang.update((c) => (c === 'en' ? 'ar' : 'en'));
  }

  /**
   * Translate a dot-path key and fill in `{{placeholders}}`.
   * Falls back to English, then to the key itself, so a missing
   * translation shows up visibly instead of breaking the UI.
   *
   * @example translate('orders.showing', { shown: 5, total: 20 })
   */
  translate(key: string, params?: Record<string, string | number>): string {
    const text = resolvePath(this.dictionary(), key) ?? resolvePath(EN, key) ?? key;
    if (!params) return text;
    return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) =>
      name in params ? String(params[name]) : match,
    );
  }

  /** Starting language: saved choice → English. */
  private getInitialLanguage(): LanguageCode {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'ar') return saved;
    } catch {
      /* ignore */
    }
    return 'en';
  }
}

/** Walk a nested object by dot path ('a.b.c'). Returns undefined if not found. */
function resolvePath(source: unknown, path: string): string | undefined {
  const value = path
    .split('.')
    .reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), source);
  return typeof value === 'string' ? value : undefined;
}
