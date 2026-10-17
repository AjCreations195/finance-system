import { inject, Injectable } from '@angular/core';
import { LanguageService } from './language.service';
import { ToastService } from './toast.service';

/**
 * ClipboardService
 * ----------------
 * Copies text and confirms with a toast: `successKey` when it worked, a
 * "couldn't copy" toast when the browser refuses or has no clipboard.
 */
@Injectable({ providedIn: 'root' })
export class ClipboardService {
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  copy(text: string, successKey: string): void {
    const done = () => this.toast.show(this.language.translate(successKey), 'success');
    const fail = () => this.toast.show(this.language.translate('requests.details.copyFailed'), 'danger');
    if (!navigator.clipboard) {
      fail();
    } else {
      navigator.clipboard.writeText(text).then(done, fail);
    }
  }
}
