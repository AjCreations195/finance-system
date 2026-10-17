import { Component, ElementRef, afterNextRender, computed, inject, input, output, signal } from '@angular/core';
import { FINAL_STATUSES, PurchaseRequest, STATUS_BADGE, STATUS_ICON, WorkflowStep } from '../../../core/models/purchase-request.model';
import { LanguageService } from '../../../core/services/language.service';
import { PurchaseRequestService } from '../../../core/services/purchase-request.service';
import { ClipboardService } from '../../../core/services/clipboard.service';
import { ToastService } from '../../../core/services/toast.service';
import { LocalDatePipe, MoneyPipe } from '../../../shared/pipes/format.pipes';
import { LocalizePipe } from '../../../shared/pipes/localize.pipe';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { IconComponent } from '../../../shared/components/icon/icon.component';

/** Figma icon per workflow step (public/icons/<name>.svg). */
const STEP_ICONS: Record<WorkflowStep['key'], string> = {
  created: 'timelinestep-created',
  approval: 'done',
  returned: 'return',
  accepted: 'approval',
  rejected: 'reject',
};

/**
 * RequestDetailsComponent ("بيانات طلب شراء")
 * ------------------------------------------
 * Side panel with everything about one purchase request, from the Figma
 * design: header tools, actions (share / approve / approve & send / more),
 * the directorate card with the total, the request fields, the approval
 * timeline, the activity log, the creator's contact and the attachments.
 *
 * It slides in from the right edge in both languages over the list, so the
 * user keeps their place, filters and selection. The parent owns the open state (it's in the URL as ?view=<id>)
 * and performs approve / delete, reusing the page's dialogs and toasts.
 *
 * Accessibility: role="dialog" + aria-modal, focus moves into the panel
 * when it opens and Tab stays inside it; Esc closes (handled by the page).
 */
@Component({
  selector: 'app-request-details',
  imports: [IconComponent, TranslatePipe, LocalizePipe, LocalDatePipe, MoneyPipe],
  templateUrl: './request-details.component.html',
  styleUrl: './request-details.component.scss',
  host: {
    '(keydown)': 'onKeydown($event)',
    '(document:click)': 'onDocumentClick($event)',
  },
})
export class RequestDetailsComponent {
  private readonly service = inject(PurchaseRequestService);
  private readonly language = inject(LanguageService);
  private readonly toast = inject(ToastService);
  private readonly clipboard = inject(ClipboardService);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  /** The request to show (the parent looks it up from the ?view id). */
  readonly request = input.required<PurchaseRequest>();
  /** Emitted when the panel asks to close (the parent removes ?view from the URL). */
  readonly closed = output<void>();
  /** Approve ('accepted') or approve & send ('sent'). */
  readonly approve = output<'accepted' | 'sent'>();
  /** Emitted when the user chooses Delete; the parent asks for confirmation. */
  readonly remove = output<void>();

  /** Panel data for this request (directorate, workflow, activity…). */
  protected readonly details = computed(() => this.service.getDetails(this.request()));
  /** Whether the Approve buttons are enabled (false for final statuses). */
  protected readonly canApprove = computed(() => !FINAL_STATUSES.includes(this.request().status));
  /** tel: link without the spaces and brackets of the displayed number. */
  protected readonly phoneHref = computed(() => 'tel:' + this.details().creatorPhone.replace(/[^\d+]/g, ''));
  /** Badge colour and icon per status (see the purchase request model). */
  protected readonly badge = STATUS_BADGE;
  protected readonly statusIcon = STATUS_ICON;
  /** Icon per workflow step. */
  protected readonly stepIcons = STEP_ICONS;

  /** Wide mode (the ⤢ button), for reading long timelines on large screens. */
  protected readonly wide = signal(false);
  /** Whether the "more" (⋯) menu is open. */
  protected readonly menuOpen = signal(false);

  constructor() {
    // Move focus into the panel so keyboard and screen-reader users land in it.
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>('.panel')?.focus());
  }

  /** Copies a link that opens this request's panel directly. */
  protected share(): void {
    this.clipboard.copy(window.location.href, 'requests.details.linkCopied');
  }

  /** Copies the request number and closes the "more" menu. */
  protected copyNumber(): void {
    this.menuOpen.set(false);
    this.clipboard.copy(this.request().number, 'requests.details.numberCopied');
  }

  /** Asks the parent to delete this request (the parent shows the confirmation). */
  protected deleteRequest(): void {
    this.menuOpen.set(false);
    this.remove.emit();
  }

  /** Attachment preview is not part of this demo, so it shows a notice. */
  protected openAttachment(): void {
    this.toast.show(this.language.translate('requests.details.previewUnavailable'), 'info');
  }

  /** Esc closes the "more" menu first (and stops there); Tab stays inside the panel. */
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.menuOpen()) {
      event.stopPropagation();
      this.menuOpen.set(false);
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = Array.from(
      this.host.nativeElement.querySelectorAll<HTMLElement>('.panel button:not([disabled]), .panel a[href], .panel [tabindex="0"]'),
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === this.host.nativeElement.querySelector('.panel'))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /** Closes the "more" menu when a click lands outside it. */
  protected onDocumentClick(event: MouseEvent): void {
    if (this.menuOpen() && !(event.target as HTMLElement).closest('.more-menu')) this.menuOpen.set(false);
  }
}
