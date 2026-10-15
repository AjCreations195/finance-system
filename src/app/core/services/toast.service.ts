import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'danger' | 'warning' | 'info';

export interface Toast {
  id: number;
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
  private nextId = 1;
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  show(message: string, type: ToastType = 'success', duration = 3500): void {
    const toast: Toast = { id: this.nextId++, message, type };
    this._toasts.update((list) => [...list, toast]);
    setTimeout(() => this.dismiss(toast.id), duration);
  }

  dismiss(id: number): void {
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
