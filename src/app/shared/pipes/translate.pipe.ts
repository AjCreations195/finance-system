import { Pipe, PipeTransform, inject } from '@angular/core';
import { LanguageService } from '../../core/services/language.service';

/**
 * TranslatePipe
 * -------------
 * Template helper for LanguageService.translate().
 *
 * Usage:
 *   {{ 'login.title' | translate }}
 *   {{ 'orders.showing' | translate: { shown: 5, total: 20 } }}
 *
 * The pipe is impure (`pure: false`) so it re-runs when the language
 * changes, not only when the key changes. It's cheap: just an object lookup.
 */
@Pipe({ name: 'translate', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly language = inject(LanguageService);

  transform(key: string, params?: Record<string, string | number>): string {
    return this.language.translate(key, params);
  }
}
