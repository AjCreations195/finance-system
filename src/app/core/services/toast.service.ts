import { inject, Injectable, signal } from '@angular/core';
import { LanguageService } from './language.service';

/** Colour and meaning of a toast (maps to a Bootstrap alert colour). */
export type ToastType = 'success' | 'danger' | 'warning' | 'info';

/** One visible notification. */
export interface Toast {
  /** Unique id, used to dismiss this toast. */
  id: number;
  /** Already-translated text to show. */
  message: string;
  type: ToastType;
}

/**
 * ToastService
 * ------------
 * Small notification queue. Any component can call `show()`;
 * ToastContainerComponent renders the list. Each toast
 * removes itself after `duration` ms.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly language = inject(LanguageService);
  /** Id given to the next toast. */
  private nextId = 1;
  private readonly _toasts = signal<Toast[]>([]);
  /** Toasts currently on screen, read-only for the container. */
  readonly toasts = this._toasts.asReadonly();

  /** Shows a toast, then removes it after `duration` milliseconds. */
  show(message: string, type: ToastType = 'success', duration = 3500): void {
    const toast: Toast = { id: this.nextId++, message, type };
    this._toasts.update((list) => [...list, toast]);
    setTimeout(() => this.dismiss(toast.id), duration);
  }

  /** The shared "not available yet" notice for features outside this demo. */
  unavailable(): void {
    this.show(this.language.translate('login.featureNotAvailable'), 'info');
  }

  /** Removes a toast early (the close button, or the timer). */
  dismiss(id: number): void {
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
