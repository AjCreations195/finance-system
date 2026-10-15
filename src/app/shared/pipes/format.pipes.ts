import { Pipe, PipeTransform, inject } from '@angular/core';
import { CURRENCY } from '../../core/models/purchase-request.model';
import { LanguageService } from '../../core/services/language.service';

/**
 * Formatting pipes based on the browser's Intl API, following the active language.
 * Both are impure so they re-format when the language changes. Intl
 * formatters are costly to create, so they're cached per locale + options.
 */
const formatterCache = new Map<string, Intl.DateTimeFormat | Intl.NumberFormat>();

function cached<T extends Intl.DateTimeFormat | Intl.NumberFormat>(key: string, create: () => T): T {
  if (!formatterCache.has(key)) formatterCache.set(key, create());
  return formatterCache.get(key) as T;
}

/** Date formatting presets. */
const DATE_STYLES: Record<string, Intl.DateTimeFormatOptions> = {
  medium: { day: 'numeric', month: 'short', year: 'numeric' },
  long: { day: 'numeric', month: 'long', year: 'numeric' },
  dateTime: { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' },
};

/**
 * Localized date.
 * @example {{ order.orderDate | localDate }}         → "Oct 12, 2026" / "12 أكتوبر 2026"
 * @example {{ order.orderDate | localDate: 'long' }}
 */
@Pipe({ name: 'localDate', pure: false })
export class LocalDatePipe implements PipeTransform {
  private readonly language = inject(LanguageService);

  transform(value: string | Date | null | undefined, style: keyof typeof DATE_STYLES = 'medium'): string {
    if (!value) return '';
    // Date-only strings ("2026-10-12") are parsed as LOCAL dates to avoid timezone day-shifts.
    const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
    const locale = this.language.locale();
    return cached(`d|${locale}|${style}`, () => new Intl.DateTimeFormat(locale, DATE_STYLES[style])).format(date);
  }
}

/**
 * Localized currency amount (uses the app-wide CURRENCY).
 * @example {{ 12500 | money }}            → "SAR 12,500.00"
 * @example {{ 12500 | money: 'compact' }} → "SAR 12.5K"
 */
@Pipe({ name: 'money', pure: false })
export class MoneyPipe implements PipeTransform {
  private readonly language = inject(LanguageService);

  transform(value: number | null | undefined, mode: 'full' | 'compact' = 'full'): string {
    if (value == null) return '';
    return formatMoney(value, this.language.locale(), mode);
  }
}

/** Shared helper, also used by chart axis/tooltip formatters. */
export function formatMoney(value: number, locale: string, mode: 'full' | 'compact' = 'full'): string {
  const options: Intl.NumberFormatOptions =
    mode === 'compact'
      ? { style: 'currency', currency: CURRENCY, notation: 'compact', maximumFractionDigits: 1 }
      : { style: 'currency', currency: CURRENCY, minimumFractionDigits: 2, maximumFractionDigits: 2 };
  return cached(`n|${locale}|${mode}`, () => new Intl.NumberFormat(locale, options)).format(value);
}
