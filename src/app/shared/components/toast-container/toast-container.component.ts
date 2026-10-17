import { Component, inject } from '@angular/core';
import { ToastService, ToastType } from '../../../core/services/toast.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { IconComponent } from '../icon/icon.component';

/** Icon per toast type. */
const ICONS: Record<ToastType, string> = {
  success: 'check-circle-fill',
  danger: 'x-circle-fill',
  warning: 'warning-fill',
  info: 'info-fill',
};

/**
 * ToastContainerComponent
 * -----------------------
 * Renders the ToastService queue in the bottom corner (bottom-right in
 * LTR, bottom-left in RTL, through the logical `inset-inline-end`).
 * `aria-live` makes screen readers announce new messages.
 *
 * Each toast is a white card like the dashboard cards; only the icon and
 * a strip on the starting edge take the type's color (from the status
 * badge tokens, so they follow light / dark mode).
 */
@Component({
  selector: 'app-toast-container',
  imports: [IconComponent, TranslatePipe],
  template: `
    <div class="toast-stack" aria-live="polite" aria-atomic="false">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="fs-toast fs-toast-{{ toast.type }}" role="status">
          <app-icon [name]="icons[toast.type]" class="toast-icon" />
          <span class="toast-message">{{ toast.message }}</span>
          <button
            type="button"
            class="btn-close toast-close"
            (click)="toastService.dismiss(toast.id)"
            [attr.aria-label]="'common.close' | translate"
          ></button>
        </div>
      }
    </div>
  `,
  styles: `
    .toast-stack {
      position: fixed;
      inset-block-end: 1.25rem;
      inset-inline-end: 1.25rem;
      z-index: 1090;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-width: calc(100vw - 2.5rem);
    }

    .fs-toast {
      --accent: var(--fs-navy);
      display: flex;
      align-items: center;
      gap: 0.625rem;
      width: 22rem;
      max-width: 100%;
      padding: 0.75rem;
      padding-inline: 0.875rem 0.75rem;
      border: 1px solid var(--fs-border);
      border-inline-start: 4px solid var(--accent);
      border-radius: 0.625rem;
      background: var(--fs-surface);
      color: var(--fs-text);
      font-size: 0.8125rem;
      font-weight: 500;
      box-shadow: 0 12px 24px -6px rgba(16, 24, 40, 0.16), 0 4px 8px -4px rgba(16, 24, 40, 0.08);
      animation: toast-in 0.25s ease-out;
    }

    .fs-toast-success {
      --accent: var(--fs-badge-completed);
    }
    .fs-toast-danger {
      --accent: var(--fs-badge-rejected);
    }
    .fs-toast-warning {
      --accent: var(--fs-badge-inProgress);
    }

    .toast-icon {
      flex-shrink: 0;
      color: var(--accent);
      font-size: 1.125rem;
    }

    .toast-message {
      flex: 1;
      line-height: 1.4;
    }

    .toast-close {
      flex-shrink: 0;
      width: 0.625rem;
      height: 0.625rem;
      background-size: 0.625rem;
    }

    @keyframes toast-in {
      from {
        opacity: 0;
        transform: translateY(0.75rem);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .fs-toast {
        animation: none;
      }
    }
  `,
})
export class ToastContainerComponent {
  protected readonly toastService = inject(ToastService);
  protected readonly icons = ICONS;
}
