import { Pipe, PipeTransform, inject } from '@angular/core';
import { LocalizedText } from '../../core/models/dashboard.models';
import { LanguageService } from '../../core/services/language.service';

/**
 * LocalizePipe
 * ------------
 * Picks the value for the active language from a { en, ar } object.
 * Impure so it updates when the language changes.
 *
 * @example {{ task.description | localize }}
 */
@Pipe({ name: 'localize', pure: false })
export class LocalizePipe implements PipeTransform {
  private readonly language = inject(LanguageService);

  transform(value: LocalizedText | null | undefined): string {
    return value ? value[this.language.lang()] : '';
  }
}
